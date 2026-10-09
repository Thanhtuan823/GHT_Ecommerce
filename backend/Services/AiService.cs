using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using GhtBackend.Data;
using GhtBackend.DTOs.Ai;
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

        public async Task<string> ProcessChatAsync(ChatRequestDto request, string role)
        {
            var apiKey = _config["Gemini:ApiKey"];
            if (string.IsNullOrEmpty(apiKey)) throw new Exception("Gemini API Key missing.");

            var tools = GetToolsByRole(role);
            var allowedTools = tools.Select(t => t?["name"]?.ToString()).Where(n => n != null).ToList();

            var contents = new JsonArray
            {
                new JsonObject
                {
                    ["role"] = "user",
                    ["parts"] = new JsonArray
                    {
                        new JsonObject { ["text"] = $"Url: {request.CurrentUrl}\nProductId: {request.CurrentProductId}\nUser says: {request.Message}" }
                    }
                }
            };

            var requestBody = new JsonObject
            {
                ["systemInstruction"] = new JsonObject
                {
                    ["parts"] = new JsonArray
                    {
                        new JsonObject { ["text"] = "Bạn là trợ lý mua hàng GHT. Chỉ dùng data từ tool calls." }
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

            return await CallGeminiLoopAsync(requestBody, apiKey, allowedTools!, contents);
        }

        private async Task<string> CallGeminiLoopAsync(JsonObject requestBody, string apiKey, List<string> allowedTools, JsonArray contentsHistory)
        {
            int maxIterations = 3;
            for (int i = 0; i < maxIterations; i++)
            {
                var content = new StringContent(requestBody.ToJsonString(), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}", content);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Gemini API error: {0}", await response.Content.ReadAsStringAsync());
                    throw new Exception("Gemini API Error");
                }

                var responseJson = JsonNode.Parse(await response.Content.ReadAsStringAsync());
                var candidate = responseJson?["candidates"]?[0];
                var parts = candidate?["content"]?["parts"]?.AsArray();

                if (parts == null || parts.Count == 0) return "Không có phản hồi.";

                var firstPart = parts[0];
                if (firstPart?["functionCall"] != null)
                {
                    var functionCall = firstPart["functionCall"];
                    var name = functionCall?["name"]?.ToString();
                    var args = functionCall?["args"];

                    if (name == null) return "Lỗi function name.";

                    contentsHistory.Add(new JsonObject
                    {
                        ["role"] = "model",
                        ["parts"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["functionCall"] = functionCall?.DeepClone()
                            }
                        }
                    });

                    if (!allowedTools.Contains(name))
                    {
                        return "Tính năng này không khả dụng cho tài khoản của bạn.";
                    }

                    object functionResult = await ExecuteFunctionAsync(name, args);

                    contentsHistory.Add(new JsonObject
                    {
                        ["role"] = "user",
                        ["parts"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["functionResponse"] = new JsonObject
                                {
                                    ["name"] = name,
                                    ["response"] = new JsonObject
                                    {
                                        ["result"] = JsonSerializer.SerializeToNode(functionResult)
                                    }
                                }
                            }
                        }
                    });

                    requestBody["contents"] = contentsHistory;
                }
                else
                {
                    return firstPart?["text"]?.ToString() ?? "";
                }
            }

            return "Trợ lý tạm thời không khả dụng do giới hạn đệ quy.";
        }

        private async Task<object> ExecuteFunctionAsync(string name, JsonNode? args)
        {
            try
            {
                switch (name)
                {
                    case "searchProducts":
                        var kw = args?["keyword"]?.ToString()?.ToLower() ?? "";
                        return await _context.Products
                            .Where(p => p.Name.ToLower().Contains(kw))
                            .Select(p => new { p.Id, p.Name, p.Price, p.InStock })
                            .Take(5).ToListAsync();

                    case "compareProducts":
                        var id1 = args?["productId1"]?.GetValue<int>();
                        var id2 = args?["productId2"]?.GetValue<int>();
                        return await _context.Products
                            .Where(p => p.Id == id1 || p.Id == id2)
                            .Select(p => new { p.Id, p.Name, p.Price, p.Specs })
                            .ToListAsync();

                    case "recommendProducts":
                        return await _context.Products
                            .OrderByDescending(p => p.SoldCount)
                            .Select(p => new { p.Id, p.Name, p.Price, p.SoldCount })
                            .Take(5).ToListAsync();

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
                        var orders = await _context.Orders.Where(o => o.Status == "PAID" || o.Status == "DELIVERED" || o.Status == "COMPLETED").ToListAsync();
                        return new { TotalRevenue = orders.Sum(o => o.TotalPrice), TotalOrders = orders.Count };

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

        private JsonArray GetToolsByRole(string role)
        {
            var customerTools = new JsonArray
            {
                new JsonObject
                {
                    ["name"] = "searchProducts",
                    ["description"] = "Tìm kiếm sản phẩm theo từ khóa",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["keyword"] = new JsonObject { ["type"] = "STRING", ["description"] = "Từ khóa tìm kiếm" }
                        },
                        ["required"] = new JsonArray { "keyword" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "compareProducts",
                    ["description"] = "So sánh 2 sản phẩm",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["productId1"] = new JsonObject { ["type"] = "INTEGER" },
                            ["productId2"] = new JsonObject { ["type"] = "INTEGER" }
                        },
                        ["required"] = new JsonArray { "productId1", "productId2" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "recommendProducts",
                    ["description"] = "Đề xuất sản phẩm bán chạy nhất",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject()
                    }
                }
            };

            var staffTools = new JsonArray
            {
                new JsonObject { ["name"] = "findProductsMissingImages", ["description"] = "Tìm sản phẩm thiếu ảnh", ["parameters"] = new JsonObject { ["type"] = "OBJECT", ["properties"] = new JsonObject() } },
                new JsonObject { ["name"] = "findProductsMissingSpecifications", ["description"] = "Tìm sản phẩm thiếu thông số", ["parameters"] = new JsonObject { ["type"] = "OBJECT", ["properties"] = new JsonObject() } },
                new JsonObject { ["name"] = "findProductsMissingTags", ["description"] = "Tìm sản phẩm thiếu tags", ["parameters"] = new JsonObject { ["type"] = "OBJECT", ["properties"] = new JsonObject() } }
            };

            var adminTools = new JsonArray
            {
                new JsonObject { ["name"] = "getRevenueReport", ["description"] = "Báo cáo doanh thu", ["parameters"] = new JsonObject { ["type"] = "OBJECT", ["properties"] = new JsonObject() } },
                new JsonObject { ["name"] = "getSalesSummary", ["description"] = "Tổng quan bán hàng", ["parameters"] = new JsonObject { ["type"] = "OBJECT", ["properties"] = new JsonObject() } },
                new JsonObject { ["name"] = "exportRevenueExcel", ["description"] = "Xuất Excel doanh thu", ["parameters"] = new JsonObject { ["type"] = "OBJECT", ["properties"] = new JsonObject() } }
            };

            var tools = new JsonArray();
            foreach(var t in customerTools) { if (t != null) tools.Add(t.DeepClone()); }

            if (role == "Staff" || role == "Admin")
            {
                foreach(var t in staffTools) { if (t != null) tools.Add(t.DeepClone()); }
            }

            if (role == "Admin")
            {
                foreach(var t in adminTools) { if (t != null) tools.Add(t.DeepClone()); }
            }

            return tools;
        }
    }
}
