const ghnToken = 'a3d717bf-8592-4f1b-8100-d942d97c2075';

async function checkShops() {
  const res = await fetch('https://online-gateway.ghn.vn/shiip/public-api/v2/shop/all', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Token': ghnToken
    }
  });

  const data = await res.json();
  console.log('Shops info:', JSON.stringify(data, null, 2));
}

checkShops();
