const ghnToken = 'a3d717bf-8592-4f1b-8100-d942d97c2075';
const ghnShopId = 6707660;

async function testCreate() {
  const payload = {
    payment_type_id: 1,
    note: "Đơn hàng GHT#23 - Đã thanh toán Online",
    required_note: "CHOXEMHANGKHONGTHU",
    client_order_code: "DH" + Math.floor(Date.now() / 1000),
    to_name: "Nguyễn Văn Test",
    to_phone: "0912345678",
    to_address: "456 Lê Duẩn, Hoàn Kiếm, Hà Nội",
    to_ward_code: "21211",
    to_district_id: 1454,
    cod_amount: 0,
    content: "HP Spectre x360 Black (x1), Chuột không dây Logitech MX Master 3S (x1)",
    weight: 2050,
    length: 30,
    width: 25,
    height: 10,
    insurance_value: 5000000,
    service_type_id: 2,
    service_id: 53321,
    items: [
      {
        name: "HP Spectre x360 Black",
        code: "hp-spectre-x360-black",
        quantity: 1,
        price: 40000000,
        length: 35,
        width: 25,
        height: 6,
        weight: 1800,
        category: { level1: "Laptop" }
      },
      {
        name: "Chuột không dây Logitech MX Master 3S",
        code: "chuot-logitech-mx-master-3s",
        quantity: 1,
        price: 2200000,
        length: 15,
        width: 10,
        height: 5,
        weight: 250,
        category: { level1: "Phụ kiện" }
      }
    ]
  };

  const res = await fetch("https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Token": ghnToken,
      "ShopId": String(ghnShopId)
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log("GHN create status:", res.status);
  console.log("GHN create response:", JSON.stringify(data, null, 2));
}

testCreate();
