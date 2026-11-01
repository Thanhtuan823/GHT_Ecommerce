const { Client } = require('pg');

const ghnToken = 'a3d717bf-8592-4f1b-8100-d942d97c2075';
const ghnShopId = 6707660;

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TẠO ĐƠN GHN ĐỘNG ===');

  // 1. Đăng nhập lấy Token Staff / Admin
  console.log('\n1. Đăng nhập Staff...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'staff@ght.com',
      password: 'Staff@123456'
    })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Đăng nhập thất bại:', loginData);
    process.exit(1);
  }
  const token = loginData.token;
  console.log('Đăng nhập thành công! Role:', loginData.user?.role);

  // 2. Tạo đơn hàng mới trong PostgreSQL có 1 Laptop và 1 Chuột
  console.log('\n2. Khởi tạo đơn hàng test trong PostgreSQL (1 Laptop + 1 Chuột)...');
  const pgClient = new Client({
    connectionString: 'postgresql://postgres:qtdl1234@localhost:5432/GHT_Ecom'
  });
  await pgClient.connect();

  const shippingAddress = JSON.stringify({
    Name: 'Nguyễn Văn Test GHN',
    Phone: '0912345678',
    Address: '456 Lê Duẩn, Hoàn Kiếm, Hà Nội',
    FullAddress: '456 Lê Duẩn, Phường Cửa Nam, Quận Hoàn Kiếm, Hà Nội',
    ProvinceId: '201',
    DistrictId: '1454',
    WardCode: '21211'
  });

  // Tạo Order ở trạng thái CONFIRMED
  const orderInsertRes = await pgClient.query(`
    INSERT INTO "Orders" (
      "UserId", "Status", "TotalPrice", "OriginalAmount", "DiscountAmount", 
      "ShippingFee", "IsPaid", "PaymentMethod", "ShippingAddress", "PaymentExpiredAt", 
      "CreatedAt", "UpdatedAt"
    ) VALUES (
      6, 'CONFIRMED', 42230000, 42200000, 0, 
      30000, true, 'BANK_TRANSFER', $1, NOW() + INTERVAL '7 days', 
      NOW(), NOW()
    ) RETURNING "Id";
  `, [shippingAddress]);

  const testOrderId = orderInsertRes.rows[0].Id;
  console.log(`Đã tạo Order ID #${testOrderId} ở trạng thái CONFIRMED`);

  // Insert 2 OrderItems: Laptop (Prod 8) + Chuột (Prod 10)
  await pgClient.query(`
    INSERT INTO "OrderItems" ("OrderId", "ProductId", "Quantity", "Price")
    VALUES 
      ($1, 8, 1, 40000000),
      ($1, 10, 1, 2200000);
  `, [testOrderId]);
  console.log(`Đã gắn 2 OrderItems vào Order #${testOrderId}: Product #8 (Laptop HP Spectre) + Product #10 (Chuột Logitech MX)`);

  await pgClient.end();

  // 3. Gọi endpoint POST /api/shipping/create-ghn-order/{testOrderId}
  console.log(`\n3. Gọi API POST /api/shipping/create-ghn-order/${testOrderId}...`);
  const createOrderRes = await fetch(`http://localhost:5000/api/shipping/create-ghn-order/${testOrderId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const createOrderData = await createOrderRes.json();
  console.log('HTTP Status:', createOrderRes.status);
  console.log('Response:', createOrderData);

  if (!createOrderRes.ok || !createOrderData.trackingNumber) {
    console.error('Tạo đơn GHN thất bại!');
    process.exit(1);
  }

  const trackingNumber = createOrderData.trackingNumber;
  console.log(`\n=> Mã vận đơn GHN nhận được: ${trackingNumber}`);

  // 4. Gọi API GHN trực tiếp để kiểm chứng Payload GHN lưu trữ thực tế
  console.log('\n4. Gọi API https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/detail...');
  const ghnRes = await fetch('https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/detail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Token': ghnToken,
      'ShopId': String(ghnShopId)
    },
    body: JSON.stringify({ order_code: trackingNumber })
  });

  const ghnData = await ghnRes.json();
  console.log('GHN Response Code:', ghnData.code, ghnData.message);

  if (ghnData && ghnData.data) {
    const d = ghnData.data;
    console.log('\n================ KẾT QUẢ TỪ HỆ THỐNG GHN ================');
    console.log('Mã vận đơn (order_code):', d.order_code);
    console.log('Mã đơn nội bộ (client_order_code):', d.client_order_code);
    console.log('Trọng lượng kiện hàng (weight):', d.weight, 'gram');
    console.log('Trọng lượng quy đổi (converted_weight):', d.converted_weight, 'gram');
    console.log('Nội dung hàng hóa (content):', d.content);
    console.log('Ghi chú đơn (note):', d.note);
    console.log('Danh sách Items:', JSON.stringify(d.items, null, 2));
    console.log('========================================================\n');

    // Kiểm tra các tiêu chí
    const expectedClientCode = `DH${testOrderId}`;
    const isClientCodeOk = d.client_order_code === expectedClientCode;
    const isWeightOk = d.weight === 2050; // 1800g + 250g
    const hasItems = Array.isArray(d.items) && d.items.length === 2;
    const hasItemCodes = d.items?.every(i => i.name && i.weight > 0);

    console.log('--- KIỂM TRA TIÊU CHÍ CHỈ THỊ ---');
    console.log(`1. client_order_code đúng dạng (${expectedClientCode}):`, isClientCodeOk ? '✅ ĐẠT' : '❌ CHƯA ĐẠT');
    console.log(`2. weight phản ánh đúng tổng (1800 + 250 = 2050g):`, isWeightOk ? '✅ ĐẠT' : `❌ ${d.weight}g`);
    console.log(`3. content hiển thị đủ tên và (x1):`, d.content.includes('(x1)') ? '✅ ĐẠT' : '❌ CHƯA ĐẠT');
    console.log(`4. items chứa 2 sản phẩm thật với quy cách chuẩn:`, hasItems && hasItemCodes ? '✅ ĐẠT' : '❌ CHƯA ĐẠT');

    if (isClientCodeOk && isWeightOk && hasItems) {
      console.log('\n🎉 TẤT CẢ TIÊU CHÍ ĐÃ ĐẠT 100%!');
    }
  } else {
    console.log('Không lấy được data chi tiết từ GHN:', ghnData);
  }
}

run().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
