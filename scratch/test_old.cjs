const ghnToken = 'a3d717bf-8592-4f1b-8100-d942d97c2075';
const ghnShopId = 6707660;

async function testOldPayload() {
  const oldPayload = {
    payment_type_id: 1,
    note: "Đơn hàng GHT#18 - Đã thanh toán Online",
    required_note: "CHOXEMHANGKHONGTHU",
    to_name: "Khách hàng mẫu",
    to_phone: "0988888888",
    to_address: "123 Test Street",
    to_ward_code: "90816",
    to_district_id: 2264,
    cod_amount: 0,
    content: "GHT Ecommerce Đơn #18",
    weight: 1000,
    length: 30,
    width: 20,
    height: 10,
    service_type_id: 2,
    service_id: 0,
    items: [
      {
        name: "Chuột không dây Logitech MX Master 3S",
        quantity: 1,
        price: 2200000,
        length: 20,
        width: 15,
        height: 10,
        weight: 500
      },
      {
        name: "HP Spectre x360 Black",
        quantity: 1,
        price: 40000000,
        length: 20,
        width: 15,
        height: 10,
        weight: 500
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
    body: JSON.stringify(oldPayload)
  });

  const data = await res.json();
  console.log("Old payload result:", res.status, data.code, data.message);
}

testOldPayload();
