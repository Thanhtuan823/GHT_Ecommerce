const ghnToken = 'a3d717bf-8592-4f1b-8100-d942d97c2075';
const ghnShopId = 6707660;

async function checkServices() {
  const res = await fetch('https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/available-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Token': ghnToken,
      'ShopId': String(ghnShopId)
    },
    body: JSON.stringify({
      shop_id: ghnShopId,
      from_district: 1544,
      to_district: 1454
    })
  });

  const data = await res.json();
  console.log('Available services:', JSON.stringify(data, null, 2));
}

checkServices();
