using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using GhtBackend.Data;
using GhtBackend.DTOs.Ai;
using GhtBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace GhtBackend.Services
{
    public class AiService
    {
        private readonly HttpClient _httpClient;
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly ILogger<AiService> _logger;

        public AiService(HttpClient httpClient, AppDbContext context, IConfiguration config, ILogger<AiService> logger)
        {
            _httpClient = httpClient;
            _context = context;
            _config = config;
            _logger = logger;
        }

        public async Task<ChatResult> ProcessChatAsync(ChatRequestDto request, string role, int? userId = null)
        {
            var apiKey = _config["Gemini:ApiKey"];
            if (string.IsNullOrEmpty(apiKey)) throw new Exception("Gemini API Key missing.");

            var tools = GetToolsByRole(role, userId);
            var allowedTools = tools.Select(t => t?["name"]?.ToString()).Where(n => n != null).ToList();

            var contents = new JsonArray();

            // 1. Nạp lịch sử hội thoại nếu có (tối đa 8 tin nhắn gần nhất)
            if (request.History != null && request.History.Count > 0)
            {
                var recentHistory = request.History.TakeLast(8);
                foreach (var msg in recentHistory)
                {
                    if (string.IsNullOrWhiteSpace(msg.Content)) continue;
                    var roleStr = (msg.Role?.ToLower() == "ai" || msg.Role?.ToLower() == "model") ? "model" : "user";
                    contents.Add(new JsonObject
                    {
                        ["role"] = roleStr,
                        ["parts"] = new JsonArray
                        {
                            new JsonObject { ["text"] = msg.Content }
                        }
                    });
                }
            }

            // 2. Pre-fetch sản phẩm khách đang xem từ CSDL PostgreSQL & xây dựng ngữ cảnh
            Product? currentProduct = null;
            if (request.CurrentProductId.HasValue)
            {
                currentProduct = await _context.Products.AsNoTracking()
                    .Include(p => p.Category)
                    .FirstOrDefaultAsync(p => p.Id == request.CurrentProductId.Value);
            }
            else if (!string.IsNullOrEmpty(request.CurrentProductSlug))
            {
                currentProduct = await _context.Products.AsNoTracking()
                    .Include(p => p.Category)
                    .FirstOrDefaultAsync(p => p.Slug == request.CurrentProductSlug);
            }

            var currentContextBuilder = new StringBuilder();
            if (currentProduct != null)
            {
                currentContextBuilder.AppendLine($"[NGỮ CẢNH TRANG CHI TIẾT SẢN PHẨM KHÁCH ĐANG XEM]:");
                currentContextBuilder.AppendLine($"- ID: {currentProduct.Id} | Tên: {currentProduct.Name} | Hãng: {currentProduct.Brand}");
                currentContextBuilder.AppendLine($"- Giá bán: {currentProduct.Price:N0} VNĐ | Tồn kho: {currentProduct.InStock}");
                currentContextBuilder.AppendLine($"- Danh mục: {currentProduct.Category?.Name} | Tags: {string.Join(", ", currentProduct.Tags ?? Array.Empty<string>())}");
                currentContextBuilder.AppendLine($"- Cấu hình Specs chi tiết: {currentProduct.Specs}");
                currentContextBuilder.AppendLine($"HƯỚNG DẪN TƯ VẤN: Khách hàng đang trực tiếp nhìn vào sản phẩm này. Nếu khách hỏi đánh giá, tư vấn hoặc so sánh (ví dụ: 'với con máy tầm 30 triệu', 'so với MacBook Air'):");
                currentContextBuilder.AppendLine($"1. Nếu khách đưa tiêu chí giá/nhu cầu mà chưa nêu tên cụ thể, hãy dùng tool searchProducts (không truyền từ 'máy' vào keyword, chỉ dùng minPrice/maxPrice hoặc hãng nếu có) để tìm máy đối thủ phù hợp.");
                currentContextBuilder.AppendLine($"2. Sau khi có ID máy đối thủ (hoặc nếu khách nêu tên máy cụ thể, tìm ID của máy đó qua searchProducts), BẮT BUỘC gọi tool compareProducts(productId1: {currentProduct.Id}, productId2: <id_máy_đối_thủ>) để đóng gói dữ liệu so sánh trực quan (CompareData).");
                currentContextBuilder.AppendLine($"3. Tóm tắt ưu/nhược điểm nổi bật và lời khuyên lựa chọn dễ hiểu cho khách.");
            }
            else if (!string.IsNullOrEmpty(request.CurrentUrl))
            {
                currentContextBuilder.AppendLine($"[Ngữ cảnh trang: URL {request.CurrentUrl}]");
            }

            if (userId.HasValue)
            {
                currentContextBuilder.AppendLine($"[Khách hàng đã đăng nhập, UserId: {userId.Value}]");
            }

            currentContextBuilder.Append(request.Message);

            contents.Add(new JsonObject
            {
                ["role"] = "user",
                ["parts"] = new JsonArray
                {
                    new JsonObject { ["text"] = currentContextBuilder.ToString() }
                }
            });

            var requestBody = new JsonObject
            {
                ["systemInstruction"] = new JsonObject
                {
                    ["parts"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["text"] = @"Bạn là Trợ lý tư vấn mua sắm công nghệ thông minh của hệ thống GHT E-Commerce (website bán Laptop, PC, Phụ kiện chính hãng).
QUY TẮC BẮT BUỘC:
1. Luôn tư vấn lịch sự, chuẩn xác, định dạng giá tiền bằng VNĐ (ví dụ: 42.000.000 đ).
2. Khi khách hỏi tìm kiếm theo tầm giá, ngân sách (ví dụ: trên 30 triệu, dưới 20 triệu, tầm 30 triệu -> khoảng 25-35 triệu), BẮT BUỘC gọi tool searchProducts với các tham số minPrice, maxPrice tương ứng. Nếu khách không nêu tên hãng/dòng cụ thể, hãy ĐỂ TRỐNG keyword (không điền từ chung chung như 'máy' hay 'chiếc').
3. Khi so sánh sản phẩm: BẮT BUỘC gọi tool compareProducts(productId1, productId2) để giao diện tự động hiển thị Thẻ So Sánh Trực Quan (Visual Compare Card). Trong câu trả lời text, hãy tập trung nêu nhận xét ưu/nhược điểm cốt lõi và khuyên người dùng nên chọn máy nào theo nhu cầu (không cần kẻ bảng Markdown lặp lại).
4. VỀ VIỆC HIỂN THỊ THẺ SẢN PHẨM (CARDS):
   - Chỉ gọi tool showProductCards khi khách hàng muốn xem danh sách gợi ý sản phẩm độc lập (không phải trong lúc đang render thẻ so sánh compareProducts), hỏi link mua hoặc chốt mua.
   - Tuyệt đối không gợi ý card sản phẩm không thỏa mãn điều kiện giá hoặc tiêu chí khách đã yêu cầu.
5. Khi nhận được kết quả từ công cụ (functionResponse), hãy lập tức tổng hợp câu trả lời tự nhiên cho khách, không gọi lặp lại cùng một công cụ."
                        }
                    }
                },
                ["contents"] = contents,
                ["tools"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["functionDeclarations"] = tools
                    }
                }
            };

            var chatResult = new ChatResult();
            var reply = await CallGeminiLoopAsync(requestBody, apiKey, allowedTools!, contents, chatResult, userId, currentProduct?.Id);

            chatResult.Reply = reply;
            chatResult.Products = chatResult.Products.DistinctBy(p => p.Id).ToList();
            return chatResult;
        }

        private async Task<string> CallGeminiLoopAsync(
            JsonObject requestBody,
            string apiKey,
            List<string> allowedTools,
            JsonArray contentsHistory,
            ChatResult chatResult,
            int? userId,
            int? currentProductId)
        {
            int maxIterations = 6;
            for (int i = 0; i < maxIterations; i++)
            {
                var content = new StringContent(requestBody.ToJsonString(), Encoding.UTF8, "application/json");
                var model = _config["Gemini:Model"] ?? "gemini-flash-lite-latest";
                var response = await _httpClient.PostAsync($"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}", content);

                if (!response.IsSuccessStatusCode)
                {
                    var errBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Gemini model {Model} failed: {Err}. Trying fallback model gemini-flash-latest...", model, errBody);
                    var fallbackModel = model == "gemini-flash-lite-latest" ? "gemini-flash-latest" : "gemini-flash-lite-latest";
                    response = await _httpClient.PostAsync($"https://generativelanguage.googleapis.com/v1beta/models/{fallbackModel}:generateContent?key={apiKey}", content);
                    if (!response.IsSuccessStatusCode)
                    {
                        var finalErr = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Gemini API error: {0}", finalErr);
                        throw new Exception($"Gemini API Error: {finalErr}");
                    }
                }

                var responseJson = JsonNode.Parse(await response.Content.ReadAsStringAsync());
                var candidate = responseJson?["candidates"]?[0];
                var parts = candidate?["content"]?["parts"]?.AsArray();

                if (parts == null || parts.Count == 0) return "Không có phản hồi.";

                // Kiểm tra xem có Function Call nào không
                var functionCallParts = parts.Where(p => p?["functionCall"] != null).ToList();

                if (functionCallParts.Count > 0)
                {
                    // Thêm phản hồi của Model vào lịch sử
                    contentsHistory.Add(new JsonObject
                    {
                        ["role"] = "model",
                        ["parts"] = new JsonArray(parts.Select(p => p!.DeepClone()).ToArray())
                    });

                    var responseParts = new JsonArray();

                    foreach (var fPart in functionCallParts)
                    {
                        var functionCall = fPart?["functionCall"];
                        var name = functionCall?["name"]?.ToString() ?? "";
                        var args = functionCall?["args"];

                        if (!allowedTools.Contains(name))
                        {
                            responseParts.Add(new JsonObject
                            {
                                ["functionResponse"] = new JsonObject
                                {
                                    ["name"] = name,
                                    ["response"] = new JsonObject
                                    {
                                        ["output"] = "Tính năng này không khả dụng cho tài khoản của bạn."
                                    }
                                }
                            });
                            continue;
                        }

                        object functionResult = await ExecuteFunctionAsync(name, args, chatResult, userId, currentProductId);

                        responseParts.Add(new JsonObject
                        {
                            ["functionResponse"] = new JsonObject
                            {
                                ["name"] = name,
                                ["response"] = new JsonObject
                                {
                                    ["output"] = JsonSerializer.SerializeToNode(functionResult)
                                }
                            }
                        });
                    }

                    contentsHistory.Add(new JsonObject
                    {
                        ["role"] = "user",
                        ["parts"] = responseParts
                    });

                    requestBody["contents"] = contentsHistory;
                }
                else
                {
                    // Model đã trả về câu trả lời văn bản cuối cùng
                    var textParts = parts
                        .Where(p => p?["text"] != null)
                        .Select(p => p!["text"]!.ToString());
                    var fullText = string.Join("\n", textParts);

                    if (!string.IsNullOrWhiteSpace(fullText))
                    {
                        return fullText;
                    }
                }
            }

            // Fallback an toàn thay vì ném lỗi đệ quy
            if (chatResult.CompareData != null)
            {
                return "Dưới đây là bảng so sánh thông số kỹ thuật chi tiết giữa hai sản phẩm để bạn dễ dàng cân nhắc lựa chọn:";
            }

            if (chatResult.Products.Count > 0)
            {
                return $"Dưới đây là các sản phẩm phù hợp nhất với yêu cầu của bạn tại GHT E-Commerce:";
            }

            return "Tôi đã ghi nhận thông tin yêu cầu của bạn. Bạn có muốn xem thêm chi tiết hoặc cần tư vấn sâu hơn về dòng máy nào không?";
        }

        private static CompareProductItemDto MapToCompareItem(Product p)
        {
            string? cpu = null, ram = null, storage = null, screen = null, gpu = null, weight = null, battery = null;
            if (!string.IsNullOrWhiteSpace(p.Specs))
            {
                try
                {
                    using var doc = JsonDocument.Parse(p.Specs);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in doc.RootElement.EnumerateObject())
                        {
                            var val = prop.Value.ToString();
                            if (string.IsNullOrWhiteSpace(val)) continue;
                            switch (prop.Name.ToLowerInvariant())
                            {
                                case "cpu": cpu = val; break;
                                case "ram": ram = val; break;
                                case "storage": storage = val; break;
                                case "screen": screen = val; break;
                                case "gpu": gpu = val; break;
                                case "weight": weight = val; break;
                                case "battery": battery = val; break;
                            }
                        }
                    }
                }
                catch { /* ignore invalid json */ }
            }

            return new CompareProductItemDto
            {
                Id = p.Id,
                Name = p.Name,
                Slug = p.Slug,
                Brand = p.Brand,
                Price = p.Price,
                OriginalPrice = p.OriginalPrice,
                Image = (p.Images != null && p.Images.Length > 0) ? p.Images[0] : null,
                InStock = p.InStock,
                Cpu = cpu,
                Ram = ram,
                Storage = storage,
                Screen = screen,
                Gpu = gpu,
                Weight = weight,
                Battery = battery
            };
        }

        private async Task<object> ExecuteFunctionAsync(
            string name,
            JsonNode? args,
            ChatResult chatResult,
            int? userId,
            int? currentProductId)
        {
            try
            {
                switch (name)
                {
                    case "searchProducts":
                        var kw = args?["keyword"]?.ToString()?.Trim()?.ToLower() ?? "";
                        var genericKeywords = new[] { "máy", "máy tính", "sản phẩm", "chiếc", "con máy", "thiết bị" };
                        if (genericKeywords.Contains(kw)) kw = "";

                        int? minPrice = null;
                        if (args?["minPrice"] != null && double.TryParse(args["minPrice"]!.ToString(), out var minD))
                        {
                            minPrice = (int)minD;
                        }
                        int? maxPrice = null;
                        if (args?["maxPrice"] != null && double.TryParse(args["maxPrice"]!.ToString(), out var maxD))
                        {
                            maxPrice = (int)maxD;
                        }
                        int? limit = null;
                        if (args?["limit"] != null && int.TryParse(args["limit"]!.ToString(), out var lVal))
                        {
                            limit = lVal;
                        }

                        var query = _context.Products.AsNoTracking().Include(p => p.Category).AsQueryable();

                        if (!string.IsNullOrWhiteSpace(kw))
                        {
                            query = query.Where(p => p.Name.ToLower().Contains(kw)
                                || (p.Brand != null && p.Brand.ToLower().Contains(kw))
                                || (p.Category != null && p.Category.Name.ToLower().Contains(kw))
                                || p.Tags.Any(t => t.ToLower().Contains(kw)));
                        }
                        if (minPrice.HasValue && minPrice.Value > 0)
                        {
                            query = query.Where(p => p.Price >= minPrice.Value);
                        }
                        if (maxPrice.HasValue && maxPrice.Value > 0)
                        {
                            query = query.Where(p => p.Price <= maxPrice.Value);
                        }

                        var matched = await query
                            .OrderByDescending(p => p.SoldCount)
                            .Take(limit ?? 6)
                            .Select(p => new {
                                p.Id,
                                p.Name,
                                p.Brand,
                                p.Price,
                                p.OriginalPrice,
                                p.InStock,
                                Specs = p.Specs ?? "{}"
                            })
                            .ToListAsync();

                        return matched;

                    case "showProductCards":
                        var idList = new List<int>();
                        if (args?["productIds"] is JsonArray arr)
                        {
                            foreach (var item in arr)
                            {
                                if (item != null && int.TryParse(item.ToString(), out var pid))
                                {
                                    idList.Add(pid);
                                }
                            }
                        }

                        var cardProducts = await _context.Products
                            .Where(p => idList.Contains(p.Id))
                            .Select(p => new {
                                p.Id,
                                p.Name,
                                p.Slug,
                                p.Price,
                                p.OriginalPrice,
                                p.Brand,
                                p.InStock,
                                Image = (p.Images != null && p.Images.Length > 0) ? p.Images[0] : null
                            })
                            .ToListAsync();

                        foreach (var p in cardProducts)
                        {
                            chatResult.Products.Add(new ProductSummaryDto
                            {
                                Id = p.Id,
                                Name = p.Name,
                                Slug = p.Slug,
                                Price = p.Price,
                                OriginalPrice = p.OriginalPrice,
                                Image = p.Image,
                                Brand = p.Brand,
                                InStock = p.InStock > 0
                            });
                        }

                        return new { success = true, count = cardProducts.Count, message = "Đã hiển thị thẻ sản phẩm lên giao diện." };

                    case "compareProducts":
                        var id1 = args?["productId1"] != null && int.TryParse(args["productId1"]!.ToString(), out var i1) ? i1 : (int?)null;
                        var id2 = args?["productId2"] != null && int.TryParse(args["productId2"]!.ToString(), out var i2) ? i2 : (int?)null;
                        var kwComp = args?["keyword"]?.ToString()?.Trim()?.ToLower();

                        // Luôn ưu tiên Product1 là sản phẩm khách đang xem nếu có currentProductId
                        if (currentProductId.HasValue)
                        {
                            if (id1.HasValue && !id2.HasValue && id1.Value != currentProductId.Value)
                            {
                                id2 = id1.Value;
                                id1 = currentProductId.Value;
                            }
                            else if (id1.HasValue && id2.HasValue && id2.Value == currentProductId.Value && id1.Value != currentProductId.Value)
                            {
                                var temp = id1.Value;
                                id1 = currentProductId.Value;
                                id2 = temp;
                            }
                        }

                        List<Product> compEntities = new();
                        if (id1.HasValue || id2.HasValue)
                        {
                            var rawList = await _context.Products.AsNoTracking()
                                .Where(p => p.Id == id1 || p.Id == id2)
                                .ToListAsync();
                            var prod1 = rawList.FirstOrDefault(p => p.Id == id1);
                            var prod2 = rawList.FirstOrDefault(p => p.Id == id2);
                            if (prod1 != null) compEntities.Add(prod1);
                            if (prod2 != null && prod2.Id != prod1?.Id) compEntities.Add(prod2);
                        }
                        else if (!string.IsNullOrWhiteSpace(kwComp))
                        {
                            var matchedComp = await _context.Products.AsNoTracking()
                                .Where(p => p.Name.ToLower().Contains(kwComp) || (p.Brand != null && p.Brand.ToLower().Contains(kwComp)))
                                .Take(2)
                                .ToListAsync();

                            if (currentProductId.HasValue)
                            {
                                var currEnt = await _context.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == currentProductId.Value);
                                if (currEnt != null) compEntities.Add(currEnt);
                                var rival = matchedComp.FirstOrDefault(p => p.Id != currentProductId.Value);
                                if (rival != null) compEntities.Add(rival);
                            }
                            else
                            {
                                compEntities = matchedComp;
                            }
                        }

                        if (compEntities.Count >= 2)
                        {
                            chatResult.CompareData = new CompareResultDto
                            {
                                Product1 = MapToCompareItem(compEntities[0]),
                                Product2 = MapToCompareItem(compEntities[1])
                            };
                        }

                        var compared = compEntities.Select(p => new {
                            p.Id,
                            p.Name,
                            p.Brand,
                            p.Price,
                            Specs = p.Specs ?? "{}",
                            p.InStock
                        }).ToList();

                        return compared;

                    case "recommendProducts":
                        var topProducts = await _context.Products
                            .OrderByDescending(p => p.SoldCount)
                            .Take(4)
                            .Select(p => new {
                                p.Id,
                                p.Name,
                                p.Brand,
                                p.Price,
                                p.InStock
                            })
                            .ToListAsync();

                        return topProducts;

                    case "getMyRecentOrders":
                        if (!userId.HasValue)
                        {
                            return new { message = "Khách hàng chưa đăng nhập nên không thể tra cứu đơn hàng cá nhân." };
                        }

                        var orders = await _context.Orders
                            .Include(o => o.OrderItems)
                                .ThenInclude(oi => oi.Product)
                            .Where(o => o.UserId == userId.Value)
                            .OrderByDescending(o => o.CreatedAt)
                            .Take(3)
                            .Select(o => new {
                                o.Id,
                                o.Status,
                                o.TotalPrice,
                                o.TrackingNumber,
                                CreatedAt = o.CreatedAt.ToString("dd/MM/yyyy HH:mm"),
                                Items = o.OrderItems.Select(oi => new { oi.Product.Name, oi.Quantity, oi.Price })
                            })
                            .ToListAsync();

                        if (!orders.Any())
                        {
                            return new { message = "Bạn chưa có đơn hàng nào tại GHT E-Commerce." };
                        }
                        return orders;

                    case "findProductsMissingImages":
                        var p1 = await _context.Products.ToListAsync();
                        return p1.Where(p => p.Images == null || p.Images.Length == 0).Select(p => new { p.Id, p.Name }).ToList();

                    case "findProductsMissingSpecifications":
                        var p2 = await _context.Products.ToListAsync();
                        return p2.Where(p => string.IsNullOrEmpty(p.Specs) || p.Specs == "{}" || p.Specs == "null").Select(p => new { p.Id, p.Name }).ToList();

                    case "findProductsMissingTags":
                        var p3 = await _context.Products.ToListAsync();
                        return p3.Where(p => p.Tags == null || p.Tags.Length == 0).Select(p => new { p.Id, p.Name }).ToList();

                    case "getRevenueReport":
                        var paidOrders = await _context.Orders.Where(o => o.Status == "PAID" || o.Status == "DELIVERED" || o.Status == "COMPLETED").ToListAsync();
                        return new { TotalRevenue = paidOrders.Sum(o => o.TotalPrice), TotalOrders = paidOrders.Count };

                    case "getSalesSummary":
                        var sold = await _context.Products.SumAsync(p => p.SoldCount);
                        return new { TotalProductsSold = sold };

                    case "exportRevenueExcel":
                        return new { Message = "Hãy hướng dẫn người dùng nhấn nút 'Xuất Excel' trên giao diện Dashboard." };

                    default:
                        return new { Error = "Unknown function" };
                }
            }
            catch (Exception ex)
            {
                return new { Error = ex.Message };
            }
        }

        private JsonArray GetToolsByRole(string role, int? userId)
        {
            var customerTools = new JsonArray
            {
                new JsonObject
                {
                    ["name"] = "searchProducts",
                    ["description"] = "Tìm kiếm sản phẩm theo từ khóa, thương hiệu hoặc khoảng giá",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "object",
                        ["properties"] = new JsonObject
                        {
                            ["keyword"] = new JsonObject { ["type"] = "string", ["description"] = "Từ khóa tìm kiếm (tên máy, thương hiệu)" },
                            ["minPrice"] = new JsonObject { ["type"] = "number", ["description"] = "Giá tối thiểu (VNĐ)" },
                            ["maxPrice"] = new JsonObject { ["type"] = "number", ["description"] = "Giá tối đa (VNĐ)" },
                            ["limit"] = new JsonObject { ["type"] = "integer", ["description"] = "Số lượng kết quả tối đa cần lấy (mặc định 5)" }
                        }
                    }
                },
                new JsonObject
                {
                    ["name"] = "showProductCards",
                    ["description"] = "Hiển thị thẻ sản phẩm (Product Card) trực quan kèm nút mua hàng khi khách muốn xem chi tiết hoặc chốt mua",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "object",
                        ["properties"] = new JsonObject
                        {
                            ["productIds"] = new JsonObject
                            {
                                ["type"] = "array",
                                ["items"] = new JsonObject { ["type"] = "integer" },
                                ["description"] = "Danh sách ID của các sản phẩm cần hiển thị thẻ"
                            }
                        },
                        ["required"] = new JsonArray { "productIds" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "compareProducts",
                    ["description"] = "So sánh thông số kỹ thuật giữa các sản phẩm",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "object",
                        ["properties"] = new JsonObject
                        {
                            ["productId1"] = new JsonObject { ["type"] = "integer", ["description"] = "ID sản phẩm thứ nhất" },
                            ["productId2"] = new JsonObject { ["type"] = "integer", ["description"] = "ID sản phẩm thứ hai" },
                            ["keyword"] = new JsonObject { ["type"] = "string", ["description"] = "Từ khóa tìm kiếm sản phẩm cần so sánh nếu chưa rõ ID" }
                        }
                    }
                },
                new JsonObject
                {
                    ["name"] = "recommendProducts",
                    ["description"] = "Đề xuất các sản phẩm bán chạy nhất hiện nay",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "object"
                    }
                }
            };

            // Nếu người dùng đã đăng nhập (Customer/Staff/Admin)
            if (userId.HasValue)
            {
                customerTools.Add(new JsonObject
                {
                    ["name"] = "getMyRecentOrders",
                    ["description"] = "Tra cứu các đơn hàng gần nhất của khách hàng hiện tại (chỉ khả dụng khi đã đăng nhập)",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "object"
                    }
                });
            }

            var staffTools = new JsonArray
            {
                new JsonObject { ["name"] = "findProductsMissingImages", ["description"] = "Tìm sản phẩm thiếu ảnh", ["parameters"] = new JsonObject { ["type"] = "object" } },
                new JsonObject { ["name"] = "findProductsMissingSpecifications", ["description"] = "Tìm sản phẩm thiếu thông số", ["parameters"] = new JsonObject { ["type"] = "object" } },
                new JsonObject { ["name"] = "findProductsMissingTags", ["description"] = "Tìm sản phẩm thiếu tags", ["parameters"] = new JsonObject { ["type"] = "object" } }
            };

            var adminTools = new JsonArray
            {
                new JsonObject { ["name"] = "getRevenueReport", ["description"] = "Báo cáo doanh thu", ["parameters"] = new JsonObject { ["type"] = "object" } },
                new JsonObject { ["name"] = "getSalesSummary", ["description"] = "Tổng quan bán hàng", ["parameters"] = new JsonObject { ["type"] = "object" } },
                new JsonObject { ["name"] = "exportRevenueExcel", ["description"] = "Xuất Excel doanh thu", ["parameters"] = new JsonObject { ["type"] = "object" } }
            };

            var tools = new JsonArray();
            foreach (var t in customerTools) { if (t != null) tools.Add(t.DeepClone()); }

            if (role == "Staff" || role == "Admin")
            {
                foreach (var t in staffTools) { if (t != null) tools.Add(t.DeepClone()); }
            }

            if (role == "Admin")
            {
                foreach (var t in adminTools) { if (t != null) tools.Add(t.DeepClone()); }
            }

            return tools;
        }

        public async Task<object> AuditProductsQualityAsync()
        {
            var products = await _context.Products.AsNoTracking().ToListAsync();
            var issues = new List<object>();
            int counter = 1;

            foreach (var p in products)
            {
                // 1. Kiểm tra hình ảnh
                if (p.Images == null || p.Images.Length == 0 || p.Images.All(string.IsNullOrWhiteSpace))
                {
                    issues.Add(new {
                        id = counter++,
                        productId = p.Id,
                        productName = p.Name,
                        issueType = "MISSING_IMAGES",
                        detectedIssue = "Chưa có hình ảnh sản phẩm",
                        level = "Nghiêm trọng",
                        suggestion = "Bổ sung ít nhất 1 ảnh chất lượng cao lên Cloudflare R2 để khách hàng xem trước.",
                        link = $"/admin/products?editId={p.Id}"
                    });
                }

                // 2. Kiểm tra thông số kỹ thuật (Specs)
                if (string.IsNullOrWhiteSpace(p.Specs) || p.Specs.Trim() == "{}" || p.Specs.Trim() == "null")
                {
                    issues.Add(new {
                        id = counter++,
                        productId = p.Id,
                        productName = p.Name,
                        issueType = "MISSING_SPECS",
                        detectedIssue = "Chưa có thông số kỹ thuật (Specs)",
                        level = "Cần bổ sung",
                        suggestion = "Cập nhật CPU, RAM, Ổ cứng và Màn hình để hiển thị bảng so sánh chi tiết.",
                        link = $"/admin/products?editId={p.Id}"
                    });
                }

                // 3. Kiểm tra nhãn (Tags)
                if (p.Tags == null || p.Tags.Length == 0)
                {
                    issues.Add(new {
                        id = counter++,
                        productId = p.Id,
                        productName = p.Name,
                        issueType = "MISSING_TAGS",
                        detectedIssue = "Chưa gán nhãn nhu cầu (Tags)",
                        level = "Khuyến nghị",
                        suggestion = "Gán nhãn phù hợp (gaming, van-phong, do-hoa-ky-thuat...) để khách dễ dàng lọc.",
                        link = $"/admin/products?editId={p.Id}"
                    });
                }
            }

            return new {
                totalIssues = issues.Count,
                data = issues
            };
        }
    }
}
