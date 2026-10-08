using GhtBackend.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace GhtBackend.Services;

public class PdfService
{
    public byte[] GenerateInvoice(Order order)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily(Fonts.Arial));

                page.Header().Element(c => ComposeHeader(c, order));
                page.Content().Element(c => ComposeContent(c, order));
                page.Footer().Element(ComposeFooter);
            });
        });

        return document.GeneratePdf();
    }

    private void ComposeHeader(IContainer container, Order order)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Item().Text("HÓA ĐƠN MUA HÀNG").FontSize(20).SemiBold().FontColor(Colors.Blue.Darken2);
                column.Item().Text($"Mã đơn: DH{order.Id}");
                column.Item().Text($"Ngày tạo: {order.CreatedAt:dd/MM/yyyy HH:mm}");
            });
        });
    }

    private void ComposeContent(IContainer container, Order order)
    {
        container.PaddingVertical(1, Unit.Centimetre).Column(column =>
        {
            column.Spacing(20);

            column.Item().Row(row =>
            {
                row.RelativeItem().Component(new AddressComponent("Thông tin khách hàng", order.User?.Name ?? "Khách hàng", order.User?.Email ?? ""));
                
                var address = order.ShippingAddress != null ? System.Text.Json.JsonSerializer.Deserialize<GhtBackend.DTOs.ShippingAddressDto>(order.ShippingAddress) : null;
                var addrStr = address != null ? $"{address.Name} - {address.Phone}\n{address.Address}, {address.WardCode}, {address.DistrictId}, {address.ProvinceId}" : "Không có";
                
                row.RelativeItem().Component(new AddressComponent("Giao hàng đến", "Địa chỉ", addrStr));
            });

            column.Item().Element(c => ComposeTable(c, order));

            column.Item().AlignRight().Text($"Tiền gốc: {order.OriginalAmount:N0} đ");
            if (order.DiscountAmount > 0)
                column.Item().AlignRight().Text($"Đã giảm: -{order.DiscountAmount:N0} đ").FontColor(Colors.Green.Darken2);
            column.Item().AlignRight().Text($"Phí vận chuyển: {order.ShippingFee:N0} đ");
            column.Item().AlignRight().Text($"TỔNG CỘNG: {order.TotalPrice:N0} đ").FontSize(14).SemiBold();
        });
    }

    private void ComposeTable(IContainer container, Order order)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(30);
                columns.RelativeColumn(3);
                columns.RelativeColumn();
                columns.RelativeColumn();
                columns.RelativeColumn();
            });

            table.Header(header =>
            {
                header.Cell().Element(CellStyle).Text("#");
                header.Cell().Element(CellStyle).Text("Sản phẩm");
                header.Cell().Element(CellStyle).AlignRight().Text("Đơn giá");
                header.Cell().Element(CellStyle).AlignRight().Text("SL");
                header.Cell().Element(CellStyle).AlignRight().Text("Thành tiền");

                static IContainer CellStyle(IContainer container)
                {
                    return container.DefaultTextStyle(x => x.SemiBold()).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
                }
            });

            int idx = 1;
            if (order.OrderItems != null)
            {
                foreach (var item in order.OrderItems)
                {
                    table.Cell().Element(CellStyle).Text(idx.ToString());
                    table.Cell().Element(CellStyle).Text(item.Product?.Name ?? $"SP-{item.ProductId}");
                    table.Cell().Element(CellStyle).AlignRight().Text($"{item.Price:N0}");
                    table.Cell().Element(CellStyle).AlignRight().Text($"{item.Quantity}");
                    table.Cell().Element(CellStyle).AlignRight().Text($"{item.Price * item.Quantity:N0}");

                    static IContainer CellStyle(IContainer container)
                    {
                        return container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5);
                    }
                    idx++;
                }
            }
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.AlignCenter().Text(x =>
        {
            x.Span("Trang ");
            x.CurrentPageNumber();
            x.Span(" / ");
            x.TotalPages();
        });
    }
}

public class AddressComponent : IComponent
{
    private string Title { get; }
    private string Name { get; }
    private string Detail { get; }

    public AddressComponent(string title, string name, string detail)
    {
        Title = title;
        Name = name;
        Detail = detail;
    }

    public void Compose(IContainer container)
    {
        container.Column(column =>
        {
            column.Item().BorderBottom(1).PaddingBottom(5).Text(Title).SemiBold();
            column.Item().PaddingTop(5).Text(Name);
            column.Item().Text(Detail);
        });
    }
}
