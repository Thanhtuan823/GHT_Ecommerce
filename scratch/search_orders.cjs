const ghnToken = 'a3d717bf-8592-4f1b-8100-d942d97c2075';
const ghnShopId = 6707660;

async function checkRecentOrders() {
  const fromDate = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const toDate = Math.floor(Date.now() / 1000);

  const res = await fetch('https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Token': ghnToken,
      'ShopId': String(ghnShopId)
    },
    body: JSON.stringify({
      shop_id: ghnShopId,
      from_time: fromDate,
      to_time: toDate,
      limit: 50
    })
  });

  const data = await res.json();
  console.log('Search status:', res.status, data.code, data.message);
  if (data.data) {
    console.log('Total orders found:', data.data.total);
    if (data.data.data) {
      data.data.data.forEach(o => {
        console.log(`Order: ${o.order_code} | Status: ${o.status} | Client: ${o.client_order_code} | Date: ${o.order_date}`);
      });
    }
  }
}

checkRecentOrders();
