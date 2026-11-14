using ClosedXML.Excel;
using GhtBackend.Data;
using GhtBackend.DTOs.Admin;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace GhtBackend.Services
{
    public class AdminService
    {
        private readonly AppDbContext _context;

        public AdminService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<DashboardDto> GetDashboardStatsAsync(DateTime? from, DateTime? to)
        {
            var validStatuses = new[] { "PAID", "DELIVERED", "COMPLETED" };

            var query = _context.Orders
                .Include(o => o.OrderItems)
                .Include(o => o.Discount)
                .Where(o => validStatuses.Contains(o.Status));

            if (from.HasValue) 
            {
                var fromUtc = DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc);
                query = query.Where(o => o.CreatedAt >= fromUtc);
            }
            if (to.HasValue) 
            {
                // Include entire end day up to 23:59:59.999
                var toUtc = DateTime.SpecifyKind(to.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                query = query.Where(o => o.CreatedAt <= toUtc);
            }

            var orders = await query.ToListAsync();

            var totalRevenue = orders.Sum(o => o.TotalPrice);
            var totalOrders = orders.Count;
            var productsSold = orders.SelectMany(o => o.OrderItems).Sum(i => i.Quantity);
            var lowStockCount = await _context.Products.CountAsync(p => p.InStock <= 10);
            var discountCost = orders.Sum(o => o.DiscountAmount);

            // Daily Revenue Chart
            var chart = orders
                .GroupBy(o => o.CreatedAt.Date)
                .Select(g => new DailyRevenueDto
                {
                    Date = g.Key.ToString("yyyy-MM-dd"),
                    Revenue = g.Sum(o => o.TotalPrice)
                })
                .OrderBy(d => d.Date)
                .ToList();

            // Discount Leaderboard
            var discounts = await _context.Discounts.ToListAsync();
            var topDiscounts = new List<DiscountRoiDto>();

            foreach (var d in discounts)
            {
                // Find all valid orders that used this discount
                var usedOrders = orders.Where(o => o.Discount?.Code == d.Code).ToList();
                
                decimal originalAmountSum = usedOrders.Sum(o => o.OriginalAmount);
                decimal discountAmountSum = usedOrders.Sum(o => o.DiscountAmount);
                
                decimal rawRoi = discountAmountSum > 0 ? (originalAmountSum / discountAmountSum) : 0;
                string roiStr = discountAmountSum > 0 ? $"{rawRoi.ToString("0.0", CultureInfo.InvariantCulture)}x" : "N/A";

                topDiscounts.Add(new DiscountRoiDto
                {
                    Code = d.Code,
                    Type = d.DiscountType,
                    Value = d.DiscountValue,
                    UsedCount = d.UsedCount,
                    TotalDiscountAmount = discountAmountSum,
                    RevenueFromCode = originalAmountSum,
                    ROI = roiStr,
                    RawRoi = rawRoi
                });
            }

            // Sắp xếp ROI giảm dần, "N/A" (RawRoi = 0) luôn xếp cuối cùng.
            topDiscounts = topDiscounts
                .OrderByDescending(d => d.RawRoi > 0 ? 1 : 0)
                .ThenByDescending(d => d.RawRoi)
                .Take(5)
                .ToList();

            return new DashboardDto
            {
                TotalRevenue = totalRevenue,
                TotalOrders = totalOrders,
                ProductsSold = productsSold,
                LowStockCount = lowStockCount,
                DiscountCost = discountCost,
                RevenueChart = chart,
                TopDiscounts = topDiscounts
            };
        }

        public async Task<byte[]> ExportExcelAsync(DateTime? from, DateTime? to, string? sheets = null)
        {
            var validStatuses = new[] { "PAID", "DELIVERED", "COMPLETED" };

            var query = _context.Orders
                .Include(o => o.User)
                .Include(o => o.Discount)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                        .ThenInclude(p => p.Category)
                .Where(o => validStatuses.Contains(o.Status));

            if (from.HasValue) 
            {
                var fromUtc = DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc);
                query = query.Where(o => o.CreatedAt >= fromUtc);
            }
            if (to.HasValue) 
            {
                var toUtc = DateTime.SpecifyKind(to.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                query = query.Where(o => o.CreatedAt <= toUtc);
            }

            var orders = await query.ToListAsync();

            // Phân tích danh sách sheets được yêu cầu
            var sheetSet = string.IsNullOrWhiteSpace(sheets)
                ? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "revenue", "discounts", "products", "inventory" }
                : new HashSet<string>(sheets.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries), StringComparer.OrdinalIgnoreCase);

            bool includeRevenue = sheetSet.Contains("revenue") || sheetSet.Contains("doanh-thu") || sheetSet.Contains("doanhthu") || sheetSet.Contains("orders");
            bool includeDiscounts = sheetSet.Contains("discounts") || sheetSet.Contains("khuyen-mai") || sheetSet.Contains("khuyenmai") || sheetSet.Contains("promotions");
            bool includeProducts = sheetSet.Contains("products") || sheetSet.Contains("san-pham") || sheetSet.Contains("sanpham") || sheetSet.Contains("hieu-suat") || sheetSet.Contains("performance");
            bool includeInventory = sheetSet.Contains("inventory") || sheetSet.Contains("ton-kho") || sheetSet.Contains("tonkho") || sheetSet.Contains("stock");

            // Mặc định xuất Doanh thu và Khuyến mãi nếu không có mục nào khớp
            if (!includeRevenue && !includeDiscounts && !includeProducts && !includeInventory)
            {
                includeRevenue = true;
                includeDiscounts = true;
            }

            using var workbook = new XLWorkbook();

            // 1. SHEET DOANH THU & ĐƠN HÀNG
            if (includeRevenue)
            {
                var wsRev = workbook.Worksheets.Add("Doanh thu");
                wsRev.Cell(1, 1).Value = "STT";
                wsRev.Cell(1, 2).Value = "Mã đơn hàng";
                wsRev.Cell(1, 3).Value = "Thời gian đặt";
                wsRev.Cell(1, 4).Value = "Khách hàng";
                wsRev.Cell(1, 5).Value = "Số điện thoại";
                wsRev.Cell(1, 6).Value = "Phương thức TT";
                wsRev.Cell(1, 7).Value = "Trạng thái";
                wsRev.Cell(1, 8).Value = "Tiền hàng gốc";
                wsRev.Cell(1, 9).Value = "Tiền giảm giá";
                wsRev.Cell(1, 10).Value = "Phí vận chuyển";
                wsRev.Cell(1, 11).Value = "Tổng thanh toán";

                var revHeader = wsRev.Range("A1:K1");
                revHeader.Style.Font.Bold = true;
                revHeader.Style.Fill.BackgroundColor = XLColor.LightGray;
                revHeader.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                int rRev = 2;
                int sttRev = 1;
                foreach (var o in orders.OrderByDescending(o => o.CreatedAt))
                {
                    wsRev.Cell(rRev, 1).Value = sttRev++;
                    wsRev.Cell(rRev, 2).Value = $"#DH{o.Id}";
                    wsRev.Cell(rRev, 3).Value = o.CreatedAt.ToString("dd/MM/yyyy HH:mm");
                    wsRev.Cell(rRev, 4).Value = o.User?.Name ?? "Khách vãng lai";
                    wsRev.Cell(rRev, 5).Value = o.User?.Phone ?? "";
                    wsRev.Cell(rRev, 6).Value = o.PaymentMethod;
                    wsRev.Cell(rRev, 7).Value = o.Status;
                    wsRev.Cell(rRev, 8).Value = o.OriginalAmount;
                    wsRev.Cell(rRev, 9).Value = o.DiscountAmount;
                    wsRev.Cell(rRev, 10).Value = o.ShippingFee;
                    wsRev.Cell(rRev, 11).Value = o.TotalPrice;

                    wsRev.Cell(rRev, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsRev.Cell(rRev, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsRev.Cell(rRev, 3).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsRev.Cell(rRev, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsRev.Cell(rRev, 7).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                    wsRev.Cell(rRev, 8).Style.NumberFormat.Format = "#,##0";
                    wsRev.Cell(rRev, 9).Style.NumberFormat.Format = "#,##0";
                    wsRev.Cell(rRev, 10).Style.NumberFormat.Format = "#,##0";
                    wsRev.Cell(rRev, 11).Style.NumberFormat.Format = "#,##0";
                    rRev++;
                }

                // Hàng tổng cộng
                if (orders.Count > 0)
                {
                    wsRev.Cell(rRev, 1).Value = "TỔNG CỘNG";
                    var sumRange = wsRev.Range(rRev, 1, rRev, 7);
                    sumRange.Merge();
                    sumRange.Style.Font.Bold = true;
                    sumRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                    wsRev.Cell(rRev, 8).Value = orders.Sum(o => o.OriginalAmount);
                    wsRev.Cell(rRev, 9).Value = orders.Sum(o => o.DiscountAmount);
                    wsRev.Cell(rRev, 10).Value = orders.Sum(o => o.ShippingFee);
                    wsRev.Cell(rRev, 11).Value = orders.Sum(o => o.TotalPrice);

                    var sumData = wsRev.Range(rRev, 8, rRev, 11);
                    sumData.Style.Font.Bold = true;
                    wsRev.Cell(rRev, 8).Style.NumberFormat.Format = "#,##0";
                    wsRev.Cell(rRev, 9).Style.NumberFormat.Format = "#,##0";
                    wsRev.Cell(rRev, 10).Style.NumberFormat.Format = "#,##0";
                    wsRev.Cell(rRev, 11).Style.NumberFormat.Format = "#,##0";
                }

                wsRev.Columns().AdjustToContents();
            }

            // 2. SHEET KHUYẾN MÃI (CHUẨN 7 CỘT CỨNG)
            if (includeDiscounts)
            {
                var discounts = await _context.Discounts.ToListAsync();
                var ws = workbook.Worksheets.Add("Khuyến mãi");

                // 7 cột cứng: STT, Mã code, Loại & Giá trị, Tổng lượt đã dùng, Tổng tiền đã giảm, Doanh thu từ mã, ROI
                ws.Cell(1, 1).Value = "STT";
                ws.Cell(1, 2).Value = "Mã code";
                ws.Cell(1, 3).Value = "Loại & Giá trị";
                ws.Cell(1, 4).Value = "Tổng lượt đã dùng";
                ws.Cell(1, 5).Value = "Tổng tiền đã giảm";
                ws.Cell(1, 6).Value = "Doanh thu từ mã";
                ws.Cell(1, 7).Value = "ROI";

                var headerRange = ws.Range("A1:G1");
                headerRange.Style.Font.Bold = true;
                headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;
                headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                int row = 2;
                int stt = 1;

                var allDiscounts = new List<DiscountRoiDto>();
                foreach (var d in discounts)
                {
                    var usedOrders = orders.Where(o => o.Discount?.Code == d.Code).ToList();
                    decimal originalAmountSum = usedOrders.Sum(o => (decimal)o.OriginalAmount);
                    decimal discountAmountSum = usedOrders.Sum(o => (decimal)o.DiscountAmount);
                    
                    decimal rawRoi = discountAmountSum > 0 ? (originalAmountSum / discountAmountSum) : 0;
                    string roiStr = discountAmountSum > 0 ? $"{rawRoi.ToString("0.0", CultureInfo.InvariantCulture)}x" : "N/A";

                    allDiscounts.Add(new DiscountRoiDto
                    {
                        Code = d.Code,
                        Type = d.DiscountType,
                        Value = d.DiscountValue,
                        UsedCount = (from.HasValue || to.HasValue) ? usedOrders.Count : d.UsedCount,
                        TotalDiscountAmount = discountAmountSum,
                        RevenueFromCode = originalAmountSum,
                        ROI = roiStr,
                        RawRoi = rawRoi
                    });
                }

                allDiscounts = allDiscounts
                    .OrderByDescending(d => d.RawRoi > 0 ? 1 : 0)
                    .ThenByDescending(d => d.RawRoi)
                    .ToList();

                foreach (var d in allDiscounts)
                {
                    ws.Cell(row, 1).Value = stt++;
                    ws.Cell(row, 2).Value = d.Code;
                    ws.Cell(row, 3).Value = d.Type == "PERCENTAGE" ? $"{d.Value}%" : $"{d.Value} đ";
                    ws.Cell(row, 4).Value = d.UsedCount;
                    ws.Cell(row, 5).Value = d.TotalDiscountAmount;
                    ws.Cell(row, 6).Value = d.RevenueFromCode;
                    ws.Cell(row, 7).Value = d.ROI;
                    
                    ws.Cell(row, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws.Cell(row, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws.Cell(row, 3).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws.Cell(row, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws.Cell(row, 7).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                    ws.Cell(row, 5).Style.NumberFormat.Format = "#,##0";
                    ws.Cell(row, 6).Style.NumberFormat.Format = "#,##0";
                    row++;
                }

                ws.Columns().AdjustToContents();
            }

            // 3. SHEET HIỆU SUẤT SẢN PHẨM
            if (includeProducts)
            {
                var wsProd = workbook.Worksheets.Add("Hiệu suất sản phẩm");
                wsProd.Cell(1, 1).Value = "STT";
                wsProd.Cell(1, 2).Value = "Mã SP";
                wsProd.Cell(1, 3).Value = "Tên sản phẩm";
                wsProd.Cell(1, 4).Value = "Danh mục";
                wsProd.Cell(1, 5).Value = "Đơn giá hiện tại";
                wsProd.Cell(1, 6).Value = "Số lượng đã bán (trong kỳ)";
                wsProd.Cell(1, 7).Value = "Doanh thu mang lại";

                var prodHeader = wsProd.Range("A1:G1");
                prodHeader.Style.Font.Bold = true;
                prodHeader.Style.Fill.BackgroundColor = XLColor.LightGray;
                prodHeader.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                var orderItems = orders.SelectMany(o => o.OrderItems).ToList();
                var productStats = orderItems
                    .GroupBy(oi => oi.ProductId)
                    .Select(g => {
                        var first = g.First();
                        var p = first.Product;
                        var qty = g.Sum(x => x.Quantity);
                        var rev = g.Sum(x => (decimal)x.Quantity * x.Price);
                        return new {
                            ProductId = g.Key,
                            ProductName = p?.Name ?? $"Sản phẩm #{g.Key}",
                            CategoryName = p?.Category?.Name ?? "Chưa phân loại",
                            CurrentPrice = p?.Price ?? first.Price,
                            SoldQuantity = qty,
                            TotalRevenue = rev
                        };
                    })
                    .OrderByDescending(x => x.TotalRevenue)
                    .ToList();

                int rProd = 2;
                int sttProd = 1;
                foreach (var p in productStats)
                {
                    wsProd.Cell(rProd, 1).Value = sttProd++;
                    wsProd.Cell(rProd, 2).Value = $"#SP{p.ProductId}";
                    wsProd.Cell(rProd, 3).Value = p.ProductName;
                    wsProd.Cell(rProd, 4).Value = p.CategoryName;
                    wsProd.Cell(rProd, 5).Value = p.CurrentPrice;
                    wsProd.Cell(rProd, 6).Value = p.SoldQuantity;
                    wsProd.Cell(rProd, 7).Value = p.TotalRevenue;

                    wsProd.Cell(rProd, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsProd.Cell(rProd, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsProd.Cell(rProd, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                    wsProd.Cell(rProd, 5).Style.NumberFormat.Format = "#,##0";
                    wsProd.Cell(rProd, 6).Style.NumberFormat.Format = "#,##0";
                    wsProd.Cell(rProd, 7).Style.NumberFormat.Format = "#,##0";
                    rProd++;
                }

                if (productStats.Count > 0)
                {
                    wsProd.Cell(rProd, 1).Value = "TỔNG CỘNG";
                    var prodSumRange = wsProd.Range(rProd, 1, rProd, 5);
                    prodSumRange.Merge();
                    prodSumRange.Style.Font.Bold = true;
                    prodSumRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                    wsProd.Cell(rProd, 6).Value = productStats.Sum(x => x.SoldQuantity);
                    wsProd.Cell(rProd, 7).Value = productStats.Sum(x => x.TotalRevenue);

                    wsProd.Cell(rProd, 6).Style.Font.Bold = true;
                    wsProd.Cell(rProd, 7).Style.Font.Bold = true;
                    wsProd.Cell(rProd, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsProd.Cell(rProd, 6).Style.NumberFormat.Format = "#,##0";
                    wsProd.Cell(rProd, 7).Style.NumberFormat.Format = "#,##0";
                }

                wsProd.Columns().AdjustToContents();
            }

            // 4. SHEET TỒN KHO & CẢNH BÁO
            if (includeInventory)
            {
                var wsInv = workbook.Worksheets.Add("Tồn kho");
                wsInv.Cell(1, 1).Value = "STT";
                wsInv.Cell(1, 2).Value = "Mã SP";
                wsInv.Cell(1, 3).Value = "Tên sản phẩm";
                wsInv.Cell(1, 4).Value = "Danh mục";
                wsInv.Cell(1, 5).Value = "Giá bán";
                wsInv.Cell(1, 6).Value = "Tồn kho";
                wsInv.Cell(1, 7).Value = "Đã bán (tổng)";
                wsInv.Cell(1, 8).Value = "Trạng thái kho";

                var invHeader = wsInv.Range("A1:H1");
                invHeader.Style.Font.Bold = true;
                invHeader.Style.Fill.BackgroundColor = XLColor.LightGray;
                invHeader.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                var allProducts = await _context.Products
                    .Include(p => p.Category)
                    .OrderBy(p => p.InStock)
                    .ToListAsync();

                int rInv = 2;
                int sttInv = 1;
                foreach (var p in allProducts)
                {
                    string stockStatus = p.InStock <= 0 ? "Hết hàng" : (p.InStock <= 5 ? "Sắp hết hàng (<=5)" : (p.InStock <= 10 ? "Tồn kho thấp (<=10)" : "Còn hàng"));
                    wsInv.Cell(rInv, 1).Value = sttInv++;
                    wsInv.Cell(rInv, 2).Value = $"#SP{p.Id}";
                    wsInv.Cell(rInv, 3).Value = p.Name;
                    wsInv.Cell(rInv, 4).Value = p.Category?.Name ?? "Chưa phân loại";
                    wsInv.Cell(rInv, 5).Value = p.Price;
                    wsInv.Cell(rInv, 6).Value = p.InStock;
                    wsInv.Cell(rInv, 7).Value = p.SoldCount;
                    wsInv.Cell(rInv, 8).Value = stockStatus;

                    wsInv.Cell(rInv, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsInv.Cell(rInv, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsInv.Cell(rInv, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsInv.Cell(rInv, 7).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    wsInv.Cell(rInv, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                    wsInv.Cell(rInv, 5).Style.NumberFormat.Format = "#,##0";
                    wsInv.Cell(rInv, 6).Style.NumberFormat.Format = "#,##0";
                    wsInv.Cell(rInv, 7).Style.NumberFormat.Format = "#,##0";

                    if (p.InStock <= 5)
                    {
                        wsInv.Cell(rInv, 8).Style.Font.FontColor = XLColor.Red;
                        wsInv.Cell(rInv, 8).Style.Font.Bold = true;
                    }
                    rInv++;
                }

                wsInv.Columns().AdjustToContents();
            }

            // Phòng ngừa lỗi workbook rỗng
            if (workbook.Worksheets.Count == 0)
            {
                var fallback = workbook.Worksheets.Add("Báo cáo");
                fallback.Cell(1, 1).Value = "Không có mục báo cáo nào được chọn.";
            }

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }
    }
}
