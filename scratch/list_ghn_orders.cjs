const ghnToken = 'a3d717bf-8592-4f1b-8100-d942d97c2075';
const ghnShopId = 6707660;

async function checkOrders() {
  const res = await fetch('https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Token': ghnToken,
      'ShopId': String(ghnShopId)
    },
    body: JSON.stringify({
      shop_id: ghnShopId,
      status: []
    })
  });

  const data = await res.json();
  console.log('Search status:', res.status, data.code, data.message);
  if (data.data) {
    console.log('Total orders:', data.data.total);
    if (data.data.data) {
      data.data.data.forEach(o => {
        console.log(`Order: ${o.order_code} | Status: ${o.status} | Client: ${o.client_order_code}`);
      });
    }
  }
}

checkOrders();
