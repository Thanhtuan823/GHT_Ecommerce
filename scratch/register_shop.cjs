const ghnToken = 'a3d717bf-8592-4f1b-8100-d942d97c2075';

async function registerShop() {
  const res = await fetch('https://online-gateway.ghn.vn/shiip/public-api/v2/shop/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Token': ghnToken
    },
    body: JSON.stringify({
      district_id: 1544,
      ward_code: "520113",
      name: "GHT Technology Store",
      phone: "0343741446",
      address: "299 Đường 30 Tháng 4, Phường Rạch Dừa, Thành phố Vũng Tàu"
    })
  });

  const data = await res.json();
  console.log('Shop register status:', res.status);
  console.log('Shop register response:', JSON.stringify(data, null, 2));
}

registerShop();
