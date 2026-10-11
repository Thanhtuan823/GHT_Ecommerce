# 🖥️ GHT — PHÂN TÍCH UI FIGMA & HƯỚNG DẪN ANTI BUILD

> Phân tích từ 13 ảnh Figma thực tế. Anti đọc file này để code đúng từng màn hình.
> Ưu tiên: pixel-perfect theo Figma — không tự sáng tạo thêm.

---

## 📊 TỔNG QUAN HỆ THỐNG — 13 MÀN HÌNH

| # | Tên file ảnh | Màn hình | Role |
|---|---|---|---|
| 1 | Khách hàng — Chi tiết sản phẩm | `/products/:slug` | Customer/Guest |
| 2 | Khách hàng — Đơn hàng và chi tiết | `/orders` + `/orders/:id` | Customer |
| 3 | Khách hàng — Giỏ hàng | `/cart` | Customer |
| 4 | Khách hàng — Khám phá sản phẩm | `/products` | Customer/Guest |
| 5 | Khách hàng — Thanh toán QR | Modal trên `/checkout` | Customer |
| 6 | Khách hàng — Thanh toán | `/checkout` | Customer |
| 7 | Mobile — Thanh toán và theo dõi đơn | `/checkout` + `/orders/:id` mobile | Customer |
| 8 | Nhân viên — Vận hành đơn hàng | `/staff/orders` | Staff |
| 9 | Quản trị — Mã giảm giá | `/admin/discounts` | Admin |
| 10 | Quản trị — Tạo và sửa mã giảm giá | Modal trên `/admin/discounts` | Admin |
| 11 | Quản trị — Tổng quan | `/admin/dashboard` | Admin |
| 12 | Tài khoản — Đăng nhập và đăng ký | `/login` + `/register` | Guest |
| 13 | Thư viện — Trạng thái UI và trợ lý AI | Design system reference | — |

---

## 🎨 DESIGN LANGUAGE THỰC TẾ (từ Figma)

### Màu sắc đang dùng

```css
/* Accent */
--color-accent: #2563EB;        /* Button primary, link, badge active */
--color-accent-bg: #EBF2FF;     /* Label pill nền xanh nhạt */

/* Text */
--color-text-primary: #1A2233;
--color-text-secondary: #4B5668;
--color-text-muted: #8A96A8;

/* Border & Background */
--color-bg-page: #F5F7FA;
--color-bg-white: #FFFFFF;
--color-border: #E4E8EF;

/* Status */
--color-success: #059669;
--color-success-bg: #D1FAE5;
--color-danger: #DC2626;
--color-danger-bg: #FEE2E2;
--color-warning-bg: #FEF3C7;
--color-warning-text: #92400E;
```

### Font
- **Inter** duy nhất toàn bộ hệ thống
- Weight dùng: 400 / 500 / 600 / 700 / 800

### Navbar — Customer (đã login)
```
[G GHT_Ecom] [≡ Danh mục] [🔍 Search bar rộng] ... [♡] [🛒 badge số] [MA avatar] [Minh Anh ▾] [VI/EN]
Height: ~56px | bg: #FFFFFF | border-bottom: 1px solid #E4E8EF
Search: bg #F5F7FA, border #E4E8EF, placeholder "Ví dụ: Dell XPS 15, MacBook M3..."
Avatar: circle 32px, bg #2563EB, text white (chữ viết tắt "MA")
```

### Navbar — Guest
```
[G GHT_Ecom] [≡ Danh mục] [🔍 Search] ... [Đăng nhập] [Đăng ký btn-primary] [VI/EN]
```

### Footer — Customer pages
```
bg: #FFFFFF | border-top: 1px solid #E4E8EF | padding: 24px 0
Layout: 3 cột
  Trái: Logo "GHT_Ecom" + tagline "Công nghệ phù hợp. Trải nghiệm an tâm."
  Giữa: "Hỗ trợ: 1900 6789 • support@ght.vn"
  Phải: "Chính sách bảo hành / Giao hàng & đổi trả" (link)
```

---

## 📄 MÀN HÌNH 1 — CHI TIẾT SẢN PHẨM `/products/:slug`

### Layout
```
Navbar
Breadcrumb: Trang chủ / Laptop / ASUS / Vivobook 15 X1504VA
  font: 13px, color: #8A96A8, separator: "/"

[2 cột chính — gap: 24px]
  Cột trái (45%): Gallery ảnh
  Cột phải (55%): Thông tin + CTA
  
[2 cột dưới — gap: 24px]
  Cột trái: Thông số kỹ thuật
  Cột phải: Đánh giá + AI box
  
Footer
```

### Cột trái — Gallery
```
Main image: bg #F5F7FA, border-radius: 12px, padding: 24px
  Ảnh sản phẩm căn giữa, object-fit: contain, height: ~280px

Thumbnail row: 4 ảnh nhỏ, gap: 8px, margin-top: 12px
  Mỗi thumbnail: border-radius: 8px, border: 2px solid transparent
  Active: border: 2px solid #2563EB
  Hover: border: 2px solid #93B5F6

Caption dưới: "Ảnh sản phẩm • Màu bạc • Thiết kế mỏng nhẹ"
  font: 12px, color: #8A96A8, text-align: center
```

### Cột phải — Thông tin
```
Badge + Mã SP (cùng dòng):
  Badge "Bán chạy": bg #EBF2FF, color #2563EB, font 11px, weight 600,
    border-radius: 4px, padding: 3px 8px
  "Mã sản phẩm: ASUS-X1504VA": font 12px, color #8A96A8, margin-left: 12px

Tên sản phẩm:
  font: 22px, weight: 700, color: #1A2233, margin-top: 8px, line-height: 1.3

Rating + tồn kho (cùng dòng, space-between):
  Trái: ⭐ 4.8 / 5 • 128 đánh giá — font 13px, color #4B5668
    icon sao: color #F59E0B
  Phải: "Còn 24 sản phẩm" — font 13px, color #059669, weight 600

Giá (dòng riêng, margin-top: 12px):
  Giá hiện tại: "14.500.000đ" — font 28px, weight: 800, color #1A2233
  Giá gốc: "15.990.000đ" — font 15px, color #A0AABC, text-decoration: line-through, margin-left: 12px
  Badge giảm: "-9%" — bg #FEE2E2, color #DC2626, font 12px, weight 700,
    border-radius: 4px, padding: 3px 8px, margin-left: 8px

Spec tags (margin-top: 16px):
  [Intel Core i5-1335U] [RAM 16GB] [SSD 512GB] [15.6" FHD]
  bg: #F1F4F9, color: #4B5668, font: 12px, weight: 500,
  border-radius: 6px, padding: 5px 10px, gap: 8px, flex-wrap: wrap

Mô tả ngắn (margin-top: 12px):
  font: 14px, color: #4B5668, line-height: 1.6

Chọn biến thể (margin-top: 16px):
  Layout: inline label + button group
  "Màu sắc" [Bạc] — "Cấu hình" [16GB / 512GB]
  Button variant: border: 1px solid #E4E8EF, border-radius: 8px,
    padding: 6px 16px, font: 13px, weight: 500
    Active: border: 2px solid #2563EB, color: #2563EB, bg: #EBF2FF

Số lượng (margin-top: 16px):
  Label "Số lượng" + [–] [1] [+] + "Tối đa 24 sản phẩm"
  Nút –/+: 32×32px, border: 1px solid #E4E8EF, border-radius: 6px
  Input số: width 40px, text-align center, border: none
  Text tối đa: font 12px, color #8A96A8, margin-left: 12px

CTA buttons (margin-top: 20px):
  [🛒 Thêm vào giỏ] — btn-primary, flex: 1, height: 48px, font: 15px, weight: 600
  [Mua ngay] — bg: #1A2233, color: white, flex: 1, height: 48px
  [♡] — border: 1px solid #E4E8EF, width: 48px, height: 48px,
    border-radius: 8px, icon size 20px, color #8A96A8
  Layout: flex, gap: 8px

Trust line (margin-top: 12px):
  "Giao hàng miễn phí • Bảo hành 24 tháng • Đổi trả 7 ngày"
  font: 12px, color: #8A96A8
```

### Thông số kỹ thuật (box trái dưới)
```
Container: bg #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px, padding: 24px

Tiêu đề: "Thông số kỹ thuật" — font 16px, weight 700, color #1A2233

Table rows: label (trái, color #8A96A8) | value (phải, color #1A2233, weight 500)
  border-bottom: 1px solid #F1F4F9 giữa các row, padding: 12px 0
  Rows: Bộ xử lý / Bộ nhớ / Màn hình / Kết nối / Hệ điều hành & trọng lượng
```

### Đánh giá & AI box (box phải dưới)
```
Container: bg #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px, padding: 24px

Header: "Đánh giá từ người mua" (trái) + badge "Đã mua hàng" (phải)
  badge: bg #D1FAE5, color #065F46, font 11px, border-radius: 4px, padding: 3px 8px

Review item:
  "Ngọc Linh • 5.0 ★★★★★" — font 13px, weight 600
  Nội dung: font 13px, color #4B5668, margin-top: 4px

AI suggestion box (margin-top: 16px):
  bg: #EBF2FF, border: 1px solid #BFCFEE, border-radius: 10px, padding: 14px 16px
  Layout: icon (✦ sparkle, color #2563EB, 20px) + text + button
  Text: "Bạn chưa biết chọn cấu hình nào?" (weight 600) + "Trợ lý GHT giúp so sánh..."
  Button [Hỏi trợ lý]: btn-ghost, font 13px, padding: 8px 16px
```

---

## 📄 MÀN HÌNH 2 — ĐƠN HÀNG `/orders` + `/orders/:id`

### Layout tổng
```
Navbar
H1: "Đơn hàng của tôi" (28px, 800) + sub "Theo dõi hành trình giao hàng..."
Filter tabs: [Tất cả (4)] [Chờ thanh toán (1)] [Đang giao (1)] [Hoàn thành (1)] [Đã huỷ (1)]
  Active tab: bg #2563EB, color white, border-radius: 8px
  Default: bg #FFFFFF, border: 1px solid #E4E8EF
  Số đếm nằm trong ngoặc, không phải badge riêng

[Chi tiết đơn nổi bật — box lớn]
[Bảng "Các đơn hàng khác" — table]
Footer
```

### Box chi tiết đơn
```
Container: bg #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px, padding: 24px

Header row (space-between):
  Trái: "Đơn #GHT1028" (font 16px, weight 700) + "Đặt ngày 08/10/2026 • 2 sản phẩm" (13px, muted)
  Phải: badge "Đang giao" + nút [↓ Tải hóa đơn PDF]
    PDF button: btn-ghost, font 13px, icon download

Progress stepper (margin-top: 20px):
  5 bước: Đã đặt hàng → Đã thanh toán → Đang xử lý → Đang giao → Hoàn thành
  Icon tròn 32px:
    Done: bg #2563EB, icon ✓ white
    Current: bg #2563EB, icon truck/ship, có pulse animation nhẹ
    Pending: bg #F1F4F9, icon muted
  Line nối: 2px, done: #2563EB, pending: #E4E8EF
  Label bên dưới: tên bước (12px, weight 600) + ngày giờ (11px, muted)

Danh sách sản phẩm (margin-top: 20px):
  Mỗi item: flex, gap 16px
    Ảnh: 64×64px, border-radius: 8px, object-fit: contain, bg #F5F7FA
    Info: Tên (13px, 600) + Specs (12px, muted) + SL
    Giá: margin-left: auto, font 14px, weight 600

[2 cột dưới — gap 24px]
  Trái: Địa chỉ giao hàng + Vận chuyển GHN
  Phải: Box tóm tắt tiền

Box tóm tắt tiền:
  bg: #F8F9FB, border: 1px solid #E4E8EF, border-radius: 10px, padding: 16px
  Rows:
    "Tổng tiền gốc" — "15.000.000đ" (color muted)
    "Mã đã áp dụng" — "GHTSALE10" (color #2563EB, weight 600)
    "Đã giảm" — "– 50.000đ" (color #059669, weight 600)
    divider: 1px solid #E4E8EF
    "Tổng thanh toán" — "14.950.000đ" (font 20px, weight 800, color #1A2233)
  Dưới: "Đã thanh toán qua chuyển khoản ngân hàng." (12px, muted)

Footer đơn: [🎧 Cần hỗ trợ?] [Liên hệ hỗ trợ] ... [Theo dõi giao hàng btn-primary]
```

### Bảng "Các đơn hàng khác"
```
Header: "Các đơn hàng khác" (18px, 700)
Table: full width, border-collapse: collapse
  Columns: Mã đơn | Ngày đặt | Sản phẩm | Tổng thanh toán | Trạng thái | Hành động
  Header row: bg #F8F9FB, font 12px, weight 600, color #8A96A8, uppercase
  Body row: padding 14px 0, border-bottom 1px solid #F1F4F9
  Hành động: text link (Thanh toán / Xem chi tiết / Mua lại) color #2563EB
```

---

## 📄 MÀN HÌNH 3 — GIỎ HÀNG `/cart`

### Layout
```
Navbar
Breadcrumb: Trang chủ / Giỏ hàng
H1: "Giỏ hàng của bạn" + sub "2 sản phẩm • Sẵn sàng cho ngày làm việc mới"
Button [Tiếp tục mua sắm] — btn-ghost, float right

[2 cột — 65% / 35%, gap: 24px]
  Cột trái: Danh sách sản phẩm
  Cột phải: Tóm tắt đơn hàng (sticky)

[Section "Mua sắm an tâm"]
[Section "Đừng bỏ lỡ ưu đãi"]
Footer
```

### Cột trái — Danh sách
```
Container: bg #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px

Header row: "✓ Chọn tất cả (2)" + labels "Đơn giá | Số lượng | Thành tiền"
  border-bottom: 1px solid #E4E8EF, padding: 14px 20px
  Checkbox custom: 16×16px, border-radius: 4px, checked: bg #2563EB

Mỗi sản phẩm (padding: 20px):
  Checkbox + Ảnh 80×80px (bg #F5F7FA, radius 8px) + Info + Controls
  Info: Tên (14px, 700) + Specs (12px, muted)
  Badge tồn kho: "Còn hàng" — bg #D1FAE5, color #065F46, font 11px, radius 4px
  Số lượng: [–] [1] [+] — nút 28×28px, border radius 6px
  Thành tiền: font 14px, weight 700
  [Xóa sản phẩm]: text, color #DC2626, font 13px, margin-top: 4px
  Divider giữa các item: 1px solid #F1F4F9
```

### Cột phải — Tóm tắt (sticky)
```
Container: bg #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px, padding: 20px
  position: sticky; top: 80px

Tiêu đề: "Tóm tắt đơn hàng" (16px, 700)

Rows:
  "Tổng tiền gốc" — "15.000.000đ"
  "Vận chuyển GHN" — "Miễn phí" (color #059669)
  divider
  "Tổng thanh toán" — "15.000.000đ" (font 22px, weight 800)

Sub: "Đã bao gồm VAT. Miễn phí giao hàng cho đơn từ 5 triệu." (11px, muted)

[Thanh toán (2 sản phẩm)] — btn-primary, full width, height: 48px, margin-top: 16px

Hint: "Bạn có thể áp mã giảm giá ở bước thanh toán." (12px, muted, text-center)

Trust line: 🔒 "Thanh toán bảo mật qua chuyển khoản ngân hàng." (12px, muted)
```

### Section "Mua sắm an tâm"
```
bg: #F8F9FB, border: 1px solid #E4E8EF, border-radius: 12px, padding: 20px
Icon shield + "Mua sắm an tâm cùng GHT" (weight 600) + mô tả
Link: "✓ Miễn phí giao hàng GHN cho đơn từ 5.000.000đ" — color #2563EB
```

### Section "Đừng bỏ lỡ ưu đãi"
```
bg: #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px, padding: 20px
Layout: text trái + button [Sao chép mã] phải
  button: btn-ghost với icon copy
Text: "Đừng bỏ lỡ ưu đãi cho đơn hàng này"
Sub: "Mã GHTSALE10 giảm 10%, tối đa 50.000đ • Đơn từ 1.000.000đ"
```

---

## 📄 MÀN HÌNH 4 — KHÁM PHÁ SẢN PHẨM `/products`

### Layout
```
Navbar
Category nav bar: [Tất cả*] [Laptop] [PC & màn hình] [Phụ kiện] [Điện thoại] [Khuyến mãi] [Tư vấn chọn máy ↗]
  Active: color #2563EB, border-bottom: 2px solid #2563EB
  height: 44px, font: 13px, weight: 500, padding: 0 16px
  border-bottom tổng: 1px solid #E4E8EF

Hero banner
[2 cột — Sidebar 200px + Main content]
Footer
```

### Hero banner
```
bg: #EBF2FF (xanh nhạt), border-radius: 10px, padding: 24px 32px
Layout: 2 cột
  Trái:
    Label: "Công nghệ cho nhịp sống của bạn" — font 12px, color #2563EB, weight 600
    H2: "Chọn đúng laptop. Làm được nhiều hơn." — 26px, 800, #1A2233
    Sub: 14px, #4B5668
    Trust: "✓ Giao nhanh toàn quốc  ✓ Đổi trả trong 7 ngày" — 12px, #059669
  Phải:
    Label: "Ưu đãi cho đơn đầu tiên"
    Code: "GHTSALE10" (color #2563EB, weight 700) + "Giảm 10% • tối đa 50.000đ"
    Button [Khám phá ưu đãi]: btn-ghost
```

### Sidebar bộ lọc (200px)
```
Header: "Bộ lọc" (14px, 700) + "Đặt lại" (link, #2563EB)
Padding: 0 16px 0 0

Nhóm filter:
  Tiêu đề nhóm: 12px, weight 600, color #4B5668, margin-bottom 8px
  Checkbox + label: 13px, gap 8px, padding 4px 0
  Checkbox: 16×16px custom, checked: #2563EB

Các nhóm:
  - Thương hiệu: ASUS(12)/Apple(8)/Dell(10)/Lenovo(9)/HP(6)/Acer(3)
  - Khoảng giá: radio options text
  - Nhu cầu sử dụng: checkboxes
  - Bộ nhớ RAM: checkboxes
Divider giữa nhóm: 1px solid #E4E8EF, margin: 16px 0
```

### Main content
```
Header: "Laptop & công nghệ" (22px, 800) + "48 sản phẩm phù hợp với bạn" (13px, muted)
  + Sort dropdown [Sắp xếp: Nổi bật ▾] — float right

Filter pills:
  [Chính hãng] [Giao hàng nhanh] [Khám phá tất cả thương hiệu]
  Underline style — không phải button
  Active: color #1A2233, border-bottom 2px solid #1A2233
  Default: color #8A96A8

Grid: 4 cột, gap: 16px
Pagination: nút số, active bg #2563EB white, default bordered
```

### Product Card (chuẩn)
```
Container: bg #FFFFFF, border: 1px solid #E4E8EF, border-radius: 10px
  hover: border-color #93B5F6, box-shadow: var(--shadow-md), transform: translateY(-2px)
  transition: all 0.2s ease

Image area: height 160px, bg #F5F7FA, border-radius 10px 10px 0 0
  object-fit: contain, padding: 12px
  Badge góc trên trái: "Bán chạy" / "Mới" / "Giảm giá"
    bg tuỳ loại, font 11px, weight 600, border-radius 4px, padding 2px 7px

Content (padding: 12px):
  Thương hiệu: 11px, #8A96A8, uppercase, letter-spacing 0.3px
  Tên: 13px, weight 600, #1A2233, 2 dòng max
  Specs: "Core i5 • 16GB • SSD 512GB" — 11px, #8A96A8

Footer card (padding: 0 12px 12px, flex space-between):
  Trái:
    Giá: 15px, weight 700, #1A2233
    Giá gốc: 11px, line-through, #A0AABC (ẩn nếu không sale)
  Phải: ♡ icon, 20px, color #8A96A8 (toggle: #DC2626 khi wishlisted)

Dưới giá:
  "Còn hàng • Giao nhanh" — 12px, color #059669
  ⭐ 4.8 (128 đánh giá) — 12px, color #8A96A8
```

---

## 📄 MÀN HÌNH 5 — QR PAYMENT (Modal trên `/checkout`)

### Modal
```
Size: modal--medium (max-width: 600px)
Padding: 24px

Header: "Thanh toán đơn #GHT1028" (18px, 700)
  + [✕] đóng modal

Row 1 (space-between):
  Badge "Chờ thanh toán" — bg #F3F4F6, color #6B7280, font 12px
  "🕐 Còn 15:00" — color #2563EB, font 13px, weight 600

[2 cột — gap 24px]
  Cột trái: QR code 160×160px + "QR minh hoạ — không dùng để thanh toán" (11px, muted, text-center)
  Cột phải:
    Số tiền: "14.950.000đ" — font 28px, weight 800, #1A2233
    Hướng dẫn: "Mở ứng dụng ngân hàng, quét QR..." — 13px, #4B5668
    Badge method: "Chuyển khoản ngân hàng • SePay" — bg #EBF2FF, color #2563EB
    Warning: "Mã hết hạn sau 15 phút. Hết thời gian, đơn chuyển sang Hết hạn." — 12px, muted

Bank info rows (margin-top: 16px):
  border-top: 1px solid #E4E8EF, padding-top: 16px
  "Ngân hàng" — "MB Bank"
  "Chủ tài khoản" — "GHT ECOM"
  "Số tài khoản" — "0123 456 789 [copy icon]"
  "Nội dung chuyển khoản" — "DHGHT1028 [copy icon]" (color #2563EB, weight 600)
  font rows: label 13px muted | value 13px weight 600 #1A2233

Warning box (margin-top: 16px):
  bg: #FEF3C7, border-radius: 8px, padding: 12px 14px
  Title: "Chờ xác nhận TT" — font 12px, weight 700, color #92400E
  Content: 12px, #92400E

Hint line: "Vui lòng chuyển đúng... để được đối soát." — 12px, muted

Footer buttons:
  [Để sau] btn-ghost + [Tôi đã chuyển khoản] btn-primary
  Tôi đã chuyển khoản: full flex-1, height: 44px
```

---

## 📄 MÀN HÌNH 6 — CHECKOUT `/checkout`

### Layout
```
Navbar
Breadcrumb: Giỏ hàng / Thông tin giao hàng / Thanh toán
H1: "Thanh toán" + sub

[2 cột — 60% / 40%, gap: 32px]
  Cột trái: Form (sections đánh số)
  Cột phải: Order summary (sticky)
Footer
```

### Cột trái — Form
```
Section 1 — "Thông tin nhận hàng":
  Header: "1. Thông tin nhận hàng" (16px, 700) + link "Chọn địa chỉ đã lưu" (#2563EB)
  Fields:
    Row 1: [Họ và tên *] [Số điện thoại *] — 2 cột
    Row 2: [Email nhận thông tin đơn hàng *] — full
    Row 3: [Tỉnh / Thành phố *] [Quận / Huyện *] — 2 cột (select)
    Row 4: [Số nhà, tên đường *] — full
    Checkbox: "Lưu địa chỉ cho lần mua sau"

Section 2 — "Vận chuyển & thanh toán":
  Header: "2. Vận chuyển & thanh toán" (16px, 700)
  
  Shipping option (radio style):
    Radio circle + icon truck + text + badge "Miễn phí"
    "Giao Hàng Nhanh (GHN)" — weight 600
    "Dự kiến nhận 10–11/10/2026 • Giao tận nhà" — 13px, muted
    
  Payment option:
    Radio circle + icon + text + badge "SePay"
    "Chuyển khoản ngân hàng qua QR"
    "Quét mã QR, chuyển đúng số tiền và nội dung đơn hàng." — 13px, muted
    
  Ghi chú: textarea [Ghi chú cho đơn hàng] optional
  
  Note: "Trạng thái thanh toán chỉ được cập nhật sau khi giao dịch được xác nhận." (12px, muted)
```

### Cột phải — Order summary (sticky)
```
Tiêu đề: "Đơn hàng của bạn" (16px, 700)

Danh sách sản phẩm:
  Mỗi item: ảnh 48×48px + tên + SL + giá
  Ảnh có badge số lượng (circle, bg #6B7280, white)

Discount box:
  bg: #D1FAE5, border: 1px solid #059669, border-radius: 8px, padding: 12px
  "✓ Đã áp dụng mã GHTSALE10" (weight 600, #065F46) + [✕]
  "Tiết kiệm được 50.000đ" (13px, #065F46)
  Sub: "Giảm 10%, tối đa 50.000đ • Đơn từ 1.000.000đ" (11px, muted)

Tính tiền:
  "Tổng tiền gốc" — "15.000.000đ" (color muted, line-through nếu có giảm)
  "Vận chuyển GHN" — "Miễn phí" (#059669)
  "Giảm giá" — "– 50.000đ" (#059669, weight 600)
  divider
  "Tổng thanh toán" — "14.950.000đ" (font 22px, weight 800)
  "Đã bao gồm VAT..." (11px, muted)

[Đặt hàng ngay] — btn-primary, full width, height: 52px, font: 16px, weight: 700
  Sau khi click → mở modal QR Payment

Note: "Bằng việc đặt hàng, bạn đồng ý với điều khoản..." (11px, muted, text-center)
```

---

## 📄 MÀN HÌNH 7 — MOBILE CHECKOUT & ORDER TRACKING

### Navbar mobile
```
[GHT_Ecom logo] ... [🔍] [🛒 badge 2]
height: 52px
```

### Checkout mobile
```
Full-width single column, padding: 16px
Form giống desktop nhưng tất cả fields full-width
Select dropdowns: full-width, height: 44px (touch-friendly)

Order summary bên dưới form (không sticky)
[Đặt hàng ngay] — full width, height: 52px, margin-bottom: 80px (tránh bottom nav)
```

### Order tracking mobile (sau khi đặt hàng)
```
Section "Theo dõi sau khi đặt hàng":
  H2: "Đơn #GHT1028" (20px, 800) + badge "Đang giao"
  Sub: "Dự kiến nhận ngày 10/10/2026"

Progress stepper — vertical (không phải horizontal):
  Mỗi bước: circle (24px) + line dọc + label + thời gian
  Done: bg #2563EB, ✓ white
  Current: bg #2563EB với pulse
  Pending: bg #F1F4F9

Địa chỉ + GHN code

Tóm tắt tiền (giống desktop)
[↓ Tải hóa đơn PDF] — btn-ghost, full width
[Cần trợ giúp? Liên hệ hỗ trợ] — link text, text-center

Bottom nav: 4 tabs cố định
```

---

## 📄 MÀN HÌNH 8 — STAFF VẬN HÀNH `/staff/orders`

### Layout
```
Navbar Staff: thêm badge "Staff" và 🔔 notification icon
H1: "Không gian vận hành" + sub + [🔄 Làm mới dữ liệu] btn-ghost

KPI row: 4 cards ngang
[2 cột — 60% table + 40% panel chi tiết]
[Section AI kiểm tra chất lượng]
Footer
```

### KPI row
```
4 cards: Chờ xác nhận TT (8) | Đã thanh toán (12) | Đang xử lý (18) | Đang giao (24)
bg: #FFFFFF, border: 1px solid #E4E8EF, border-radius: 10px, padding: 16px 20px
  Label: 13px, muted | Number: 28px, 800, #1A2233
  Không có màu accent riêng — neutral
```

### Filter bar
```
[Tìm đơn hàng... input] [Trạng thái dropdown] [Thời gian dropdown] [🔽 Lọc đơn btn-primary]
Input: flex-1, border: 1px solid #E4E8EF
Dropdowns: border: 1px solid #E4E8EF, border-radius: 8px
```

### Table + Detail panel (2 cột)
```
Bảng "Hàng đợi xử lý" (60%):
  Columns: Mã đơn | Khách hàng | Giá trị | Trạng thái | Thao tác
  Row active: bg #EBF2FF (hàng đang chọn xem)
  Thao tác: text links ("Xác nhận →" / "Xem giao dịch" / "Đang chọn" / "Xử lý →" / "Giao hàng →")

Panel chi tiết (40%):
  bg: #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px, padding: 20px
  
  Header: "Đơn #GHT1031" + badge "Đã thanh toán"
  Customer: "Nguyễn Minh Anh • 0901 234 567"
  Address: 13px, muted
  
  Product list: tên × số lượng, compact
  Shipping: "GHN • Miễn phí vận chuyển"
  Total: "Tổng thanh toán: 14.950.000đ" (weight 700)
  
  "Ghi chú nội bộ" textarea: bg #F8F9FB, border-radius: 8px
    Placeholder hoặc giá trị có thể edit được
  
  [Huỷ đơn] btn-ghost danger + [Xác nhận đơn] btn-primary
  Note nhỏ: "Sau xác nhận: Đã xác nhận → Đang xử lý → Đang giao." (12px, muted)
```

### AI kiểm tra chất lượng
```
Header: ✦ "AI kiểm tra chất lượng sản phẩm" + [✨ Chạy kiểm tra mới] btn với gradient icon
Sub: "Ưu tiên hoàn thiện thông tin trước khi đưa sản phẩm lên cửa hàng."

Table:
  Columns: Sản phẩm | Vấn đề phát hiện | Mức độ | Gợi ý xử lý | Hành động
  Badge mức độ: "Cần bổ sung" — bg #FEF3C7, color #92400E
  Hành động: "Sửa sản phẩm" — link #2563EB
```

---

## 📄 MÀN HÌNH 9 — ADMIN MÃ GIẢM GIÁ `/admin/discounts`

### Layout admin (sidebar + content)
```
Sidebar: 170px fixed
  Logo: "GHT_Ecom" + "Không gian quản trị" (11px, muted)
  Nav items: icon + label, active: bg #EBF2FF, color #2563EB, border-radius: 8px
  Items: Tổng quan / Sản phẩm / Danh mục / Đơn hàng / Người dùng / [Mã giảm giá active] / Báo cáo / Trợ lý AI
  Footer sidebar: "GHT • Quản trị viên" + [Cài đặt ↗] [Đăng xuất]

Top bar: breadcrumb "Quản trị / Mã giảm giá" + 🔔 + "VI/EN" + badge "Admin" + "Hoàng Nam"

Content area: padding: 32px
```

### KPI row (4 cards)
```
Tổng số mã (6) | Đang chạy (3) | Hết lượt (1) | Đã tắt (1)
border: 1px solid #E4E8EF, border-radius: 10px, padding: 20px 24px
Label: 13px, muted | Number: 32px, 800
```

### Filter + Search bar
```
[🔍 Tìm theo mã hoặc mô tả...] flex-1 + [Trạng thái: Tất cả ▾] + [Loại giảm: Tất cả ▾]
border-bottom: 1px solid #E4E8EF, padding-bottom: 16px
[+ Tạo mã giảm giá] btn-primary float right (ở header, không cùng row filter)
```

### Bảng mã giảm giá (6 cột)
```
Header: bg #F8F9FB, font 12px, weight 600, color #8A96A8, padding: 12px 16px
Rows: padding: 14px 16px, border-bottom: 1px solid #F1F4F9

Cột 1 — Mã Code:
  "GHTSALE10" — color #2563EB, weight 700, font 14px
  [copy icon] bên cạnh — 14px, color #8A96A8, hover: #2563EB

Cột 2 — Loại & Giá trị:
  "−10%" hoặc "−50.000đ" — font 13px, weight 600, #1A2233
  "Tối đa 50.000đ" (nếu có) — 11px, muted

Cột 3 — Tiến độ:
  "45 / 200 lượt" — font 12px, #4B5668
  Progress bar: height 4px, border-radius 2px
    Fill: #2563EB (bình thường) / #DC2626 (hết lượt / gần hết)
    Track: #E4E8EF

Cột 4 — Thời hạn:
  "01/10/2026 → 31/10/2026" — font 12px, #4B5668

Cột 5 — Trạng thái: badge theo getDiscountStatus()

Cột 6 — Hành động:
  "Chi tiết" "Sửa" "Tắt/Bật" — text links, 13px
  "Chi tiết" "Sửa": color #2563EB
  "Tắt": color #DC2626

Pagination: "Hiển thị 6 / 6 mã giảm giá" + prev/next
Info box dưới: "Kiểm soát ưu đãi rõ ràng..." — bg #EBF2FF, border-radius 8px, padding 12px
```

---

## 📄 MÀN HÌNH 10 — MODAL TẠO/SỬA MÃ

```
modal--large (max-width: 860px), padding: 32px
Header: "Sửa mã giảm giá" (20px, 700) + "GHTSALE10 • Các trường có * là bắt buộc" (13px, muted) + [✕]

Layout 2 cột (gap: 32px):

CỘT TRÁI:
  Mã code *: input + icon ✓ (validated)
  Mô tả *: input
  Loại giảm *: radio [● Phần trăm (%)] [○ Số tiền cố định]
  Giá trị giảm *: input + "%" unit
  Trần tối đa: input + "đ" unit (chỉ hiện khi %)
    Note: "Chỉ hiển thị khi giảm theo phần trăm." (11px, muted)
  Đơn tối thiểu: input + "đ" unit
  
  Preview box (bg #F8F9FB, border-radius: 8px, padding: 12px):
    "Xem trước: Số tiền cố định"
    "Giá trị giảm: 50.000đ • Ẩn trường Trần tối đa"

CỘT PHẢI:
  Đối tượng áp dụng: select [Danh mục (CATEGORY) ▾]
  
  Danh mục áp dụng (hiện khi CATEGORY):
    Input tags: [Laptop ×] [Phụ kiện ×] + placeholder
    Thương hiệu BRAND → tag input tương tự
    NEW_ARRIVAL → input số ngày
    
  Tổng lượt dùng: input number (trống = ∞)
    Note: "Để trống = không giới hạn (∞)" (11px, muted)
  Lượt / tài khoản: input number
  
  Thời gian hiệu lực *:
    [Ngày bắt đầu select] [Ngày kết thúc select]
    
  Trạng thái: radio [● Bật] [○ Tắt]
    Dot: 8×8px, bg #059669 (Bật) / #DC2626 (Tắt)
  
  "Xem trước các điều kiện thay thế" box: #F8F9FB

Summary bar (full width, border-top 1px solid #E4E8EF, padding-top: 16px):
  Icon mail + "Giảm 10%, tối đa 50.000đ • Đơn từ 1.000.000đ • Mỗi tài khoản 1 lượt"
  bg: #EBF2FF, border-radius: 8px, padding: 10px 14px, font: 12px, color: #2563EB

Note: "Thay đổi áp dụng cho lượt sử dụng tiếp theo." (12px, muted)
Footer: [Huỷ] btn-ghost + [Lưu mã giảm giá] btn-primary
```

---

## 📄 MÀN HÌNH 11 — ADMIN DASHBOARD `/admin/dashboard`

### KPI row (4 cards)
```
Doanh thu: icon chart, "428.500.000đ", "↑ 12,8% so với kỳ trước" (color #059669)
Đơn hàng: icon box, "126", "↑ 8,6%"
Giá trị đơn TB: icon trending, "3.400.794đ", "↑ 3,9%"
Chi phí KM: icon 🏷️ (color #D97706), "5.400.000đ", "118 lượt dùng mã hợp lệ" (muted)

Card: bg #FFFFFF, border: 1px solid #E4E8EF, border-radius: 10px, padding: 20px
Label: 13px, muted | Value: 28px, 800 | Trend: 13px, weight 500
```

### Charts row (2 cột)
```
Cột trái (60%): "Doanh thu theo ngày"
  Area/line chart — line #2563EB, fill #EBF2FF (nhạt)
  X-axis: ngày (01/10 → 08/10) | Y-axis: triệu đồng
  Tab [Doanh thu] active — btn-primary nhỏ

Cột phải (40%): "Nhóm sản phẩm"
  Donut chart: Laptop 65% (#2563EB) | Màn hình 22% (#1A2233) | Phụ kiện 13% (#8A96A8)
  Legend bên phải: màu dot + label + %
  Center: "65%"
  Note: "Laptop tiếp tục là nhóm dẫn dắt doanh thu."
```

### Top 5 mã giảm giá
```
Header: "Top 5 mã giảm giá hiệu quả" + sub + [Quản lý mã →] link

Table:
  Columns: Hạng | Mã code | Lượt dùng | Doanh thu từ mã | Chi phí giảm | ROI
  Header: bg #F8F9FB, 12px, muted uppercase
  
  Row 1 (rank 01): Mã code màu #2563EB, weight 700
    ROI badge: "20.0x" — bg #D1FAE5, color #065F46, font 12px, weight 700, border-radius: 4px
  Row 2–4: ROI text thuần "16.0x" "12.0x" "8.0x" — #1A2233
  Row 5 (N/A): "N/A" — color #8A96A8

Note: "Đơn đủ điều kiện: Đã thanh toán, Đã giao hoặc Hoàn thành..."
```

### Đơn hàng gần đây
```
Header: "Đơn hàng gần đây" + [Xem tất cả →]
Table: Mã đơn | Khách hàng | Tổng thanh toán | Trạng thái | Thời gian
Badge trạng thái theo đúng class
```

---

## 📄 MÀN HÌNH 12 — ĐĂNG NHẬP & ĐĂNG KÝ `/login` `/register`

### Layout 3 cột
```
bg: #F5F7FA toàn trang

Cột trái (25%): Brand panel
  bg: transparent, padding: 48px 32px
  Label: "Chào mừng đến GHT" — bg #EBF2FF, color #2563EB, border-radius: 20px, padding: 4px 12px
  H1: "Một tài khoản. Trọn trải nghiệm công nghệ." — 28px, 800, #1A2233
  Sub: 14px, #4B5668
  Trust box: bg #F8F9FB, border: 1px solid #E4E8EF, border-radius: 10px, padding: 16px
    icon shield + "An toàn & riêng tư" (weight 600) + mô tả
  "Cần trợ giúp? support@ght.vn" — 13px, muted, margin-top: auto

Form Đăng nhập (35%):
  bg: #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px, padding: 32px
  H2: "Đăng nhập" (22px, 800)
  Sub: "Chào bạn, rất vui được gặp lại!"
  [Đăng nhập bằng Google] — btn-ghost, full width, icon Google 16px
  divider: "hoặc bằng email" (text giữa 2 line)
  Fields: Email * / Mật khẩu *
  Row: [☑ Ghi nhớ đăng nhập] + [Quên mật khẩu?] link
  [Đăng nhập] btn-primary full width height 48px
  Note: "Chưa có tài khoản? Tạo tài khoản ở bên cạnh."
  Sub: "Đăng nhập để đồng bộ giỏ hàng..."

Form Đăng ký (40%):
  bg: #FFFFFF, border: 1px solid #E4E8EF, border-radius: 12px, padding: 32px
  H2: "Tạo tài khoản" (22px, 800)
  Sub: "Bắt đầu mua sắm và nhận ưu đãi dành riêng cho bạn."
  Fields:
    Row: [Họ và tên *] [Số điện thoại]
    [Email *] — input với icon ✓ (validated, border #059669)
    [Mật khẩu *] — input + eye icon toggle
    Password strength bar (4 bar, màu đỏ→vàng→xanh):
      "Rất mạnh" label (color #059669)
      Checklist: ✓ Ít nhất 8 ký tự ✓ Chữ hoa ✓ Chữ số ✓ Ký tự đặc biệt
      font: 11px, color: #059669
    [Nhập lại mật khẩu *] — input với icon ✓
  [☑ Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật của GHT.]
  [Tạo tài khoản] btn-primary full width height 48px
  Note: "Không gửi thư rác. Bạn có thể huỷ nhận ưu đãi bất cúc lúc nào." (11px, muted, center)
```

---

## 📄 MÀN HÌNH 13 — DESIGN SYSTEM REFERENCE

### Components chuẩn (Anti dùng đây làm nguồn gốc)

**Input states:** Default / Active (blue border + ring) / Lỗi (red border) / Hợp lệ (green border + ✓) / Disabled
**Buttons:** [Đặt hàng ngay] primary | [Áp dụng] dark | [Huỷ] ghost | [Đang xử lý...] loading spinner

**Password strength 4 bar:**
```
1 bar đỏ: "Yếu"
2 bar vàng: "Trung bình"
3 bar xanh nhạt: "Mạnh"
4 bar xanh: "Rất mạnh"
Bar: height 4px, border-radius 2px, width mỗi bar = 25% - gap
```

**Order status badges (tên tiếng Việt + enum):**
```
Chờ thanh toán (PENDING_PAYMENT): #F3F4F6 / #6B7280
Chờ xác nhận TT (PENDING_REVIEW): #FEF3C7 / #92400E
Đã thanh toán (PAID): #D1FAE5 / #065F46
Đã xác nhận (CONFIRMED): #FEF3C7 / #92400E  
Đang xử lý (PROCESSING): #EBF2FF / #1D4ED8
Đang giao (SHIPPING): #EBF2FF / #1D4ED8
Hoàn thành (DELIVERED/COMPLETED): #D1FAE5 / #065F46
Đã huỷ (CANCELLED): #FEE2E2 / #991B1B
TT thất bại (PAYMENT_FAILED): #FEE2E2 / #991B1B
Hết hạn (EXPIRED): #F3F4F6 / #6B7280
```

**Product badges:** Bán chạy (#EBF2FF/#2563EB) | Giảm giá (#FEE2E2/#DC2626) | Mới (#D1FAE5/#065F46)

**Discount badges:**
```
Đang chạy: #D1FAE5 / #065F46
Hết lượt: #FEF3C7 / #92400E
Hết hạn: #F3F4F6 / #6B7280
Đã tắt: #FEE2E2 / #991B1B
```

**Toast (góc phải, cách lề 24px):**
```
✓ Thêm vào giỏ — SUCCESS (green left border, 3s)
⚠ Không thể tải dữ liệu — ERROR (red, 5s)
△ Sản phẩm sắp hết — WARNING (yellow, 3s)
ℹ Chờ xác nhận thanh toán — INFO (blue, 3s)
```

**Empty states (4 loại):**
```
Giỏ hàng trống: icon cart + "Thêm sản phẩm bạn yêu thích..." + [Khám phá sản phẩm]
Không tìm thấy SP: icon search + "Thử từ khác hoặc bỏ bớt bộ lọc" + [Xóa bộ lọc]
Chưa có đơn hàng: icon box + "Đơn hàng của bạn sẽ hiển thị..." + [Mua sắm ngay]
Chưa có yêu thích: icon heart + "Chạm vào trái tim..." + [Khám phá ngay]
```

**AI Chatbot window 360×480:**
```
Header: bg #2563EB, "✦ Trợ GHT" + "Tư vấn chọn sản phẩm" (12px) + [–] [✕]
Bubble AI: bg #F1F4F9, border-radius 0 10px 10px 10px
Bubble User: bg #2563EB, color white, border-radius 10px 10px 0 10px
Product card trong chat: ảnh 40px + tên + giá + [Xem sản phẩm →] link
Input area: border-top 1px solid #E4E8EF, [Nhập câu hỏi...] + [Gửi] btn-primary
```

**Skeleton:**
- Gradient shimmer animation 1.4s
- Tối thiểu 300ms dù data về nhanh
- "Chưa tải được sau 5 giây" → error + [🔄 Thử lại]

---

## 🚀 HƯỚNG DẪN ANTI BUILD THEO MÀN HÌNH

### Thứ tự build frontend (trong mỗi Task)

```
Task 1 (Auth):
  1. /login — layout 3 cột, form đăng nhập, Google OAuth button
  2. /register — cùng layout, form đăng ký, password strength 4 bar
  3. AuthContext — lưu JWT, decode role, expose user info

Task 2 (Products):
  1. ProductCard component — đúng specs màn hình 4
  2. /products — layout sidebar + grid, filter, sort, pagination
  3. /products/:slug — gallery, spec table, review, AI box

Task 3 (Cart):
  1. CartContext — guest localStorage + customer API
  2. /cart — layout 2 cột, danh sách, tóm tắt, trust sections

Task 4 (Checkout & Orders):
  1. /checkout — form 2 cột, GHN dropdowns, order summary
  2. Modal QR Payment — countdown, bank info, copy buttons
  3. /orders — tabs filter, chi tiết đơn, progress stepper, bảng đơn khác

Task 6 (Admin):
  1. Admin layout — sidebar 170px + content area
  2. /admin/dashboard — KPI cards, charts, leaderboard, recent orders
  3. /admin/discounts — table 6 cột, KPI 4 cards, modal tạo/sửa

Task 8 (Staff):
  1. /staff/orders — KPI row, filter, split table/detail panel, AI quality check
```

### Checklist trước khi báo cáo mỗi màn hình

```
[ ] Navbar đúng theo role (Customer / Staff / Admin sidebar)
[ ] Màu CHÍNH XÁC theo bảng Design System — không tự pick màu
[ ] Font size và weight đúng theo từng element
[ ] Border-radius đúng (card: 10px / modal: 12px / button: 8px / badge: 4px)
[ ] Spacing: padding, gap đúng bội số 4px
[ ] Hover state card hoạt động (translateY + shadow + border)
[ ] Form validation đúng 5 trạng thái
[ ] Badge status dùng đúng class và màu
[ ] Toast đúng góc bottom-right, đúng loại, đúng duration
[ ] Empty state có đủ (icon + text + CTA button)
[ ] Skeleton loading hiện đúng chỗ
[ ] AI Chatbot floating bottom-left 52×52px
[ ] Mobile: bottom nav 4 tabs, padding-bottom 60px
[ ] QR modal: KHÔNG tự set PAID, chỉ set PENDING_REVIEW
[ ] Discount: ẩn dòng mã/giảm nếu đơn không dùng mã
```
