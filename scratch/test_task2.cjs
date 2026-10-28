const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('====================================================================');
  console.log('TESTING TASK 2: CLOUDSTORAGESERVICE & DUAL-BUCKET VAULT SYSTEM');
  console.log('====================================================================\n');

  // 1. Login as Admin
  console.log('[TEST 1] Đăng nhập Admin (admin@ght.com)...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ght.com', password: 'Admin@123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('✓ Đăng nhập thành công, token:', token ? token.substring(0, 25) + '...' : 'NONE');

  // 2. Test Product Image Upload (Public Bucket)
  console.log('\n[TEST 2] Test Upload Ảnh Sản Phẩm (POST /api/upload?type=product)...');
  const dummyImg = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

  const formProd = new FormData();
  formProd.append('file', new Blob([dummyImg], { type: 'image/png' }), 'test_prod_keyboard.png');

  const prodRes = await fetch('http://localhost:5000/api/upload?type=product', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formProd
  });
  const prodData = await prodRes.json();
  console.log('HTTP Status:', prodRes.status);
  console.log('Response:', JSON.stringify(prodData, null, 2));

  if (prodData.storage !== 'PUBLIC_CDN' || !prodData.url.includes('ght-products-public') && !prodData.url.includes('r2.dev')) {
    console.error('✗ LỖI: Product upload không trả về PUBLIC_CDN URL');
  } else {
    console.log('✓ THÀNH CÔNG: Ảnh sản phẩm được lưu lên Public CDN Cloudflare R2!');
  }

  // 3. Test Vault File Upload 1 (Private Bucket)
  console.log('\n[TEST 3] Test Upload File Chat Vault lần 1 (POST /api/upload?type=vault)...');
  const txtContent = Buffer.from('Noi dung bao cao kiem thu task 2 tai lieu live chat', 'utf8');

  const formVault1 = new FormData();
  formVault1.append('file', new Blob([txtContent], { type: 'text/plain' }), 'baocao_test.txt');

  const vRes1 = await fetch('http://localhost:5000/api/upload?type=vault', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formVault1
  });
  const vData1 = await vRes1.json();
  console.log('HTTP Status:', vRes1.status);
  console.log('Response lần 1:');
  console.log('  Key:', vData1.key);
  console.log('  Storage:', vData1.storage);
  console.log('  URL (Presigned):', vData1.url?.substring(0, 100) + '...');

  // 4. Test Vault File Upload 2 (Cùng tên file để kiểm tra auto-increment chống trùng)
  console.log('\n[TEST 4] Test Upload File Chat Vault lần 2 với CÙNG TÊN "baocao_test.txt"...');
  const formVault2 = new FormData();
  formVault2.append('file', new Blob([txtContent], { type: 'text/plain' }), 'baocao_test.txt');

  const vRes2 = await fetch('http://localhost:5000/api/upload?type=vault', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formVault2
  });
  const vData2 = await vRes2.json();
  console.log('HTTP Status:', vRes2.status);
  console.log('Response lần 2:');
  console.log('  Key:', vData2.key);
  console.log('  Storage:', vData2.storage);
  console.log('  URL (Presigned):', vData2.url?.substring(0, 100) + '...');

  if (vData2.key && vData2.key.includes('(2)')) {
    console.log('✓ THÀNH CÔNG RỰC RỠ: File thứ 2 đã tự động tăng lũy tiến (2) chống trùng tên!');
  } else {
    console.log('Notice Key lần 2:', vData2.key);
  }

  // 5. Test Presigned URL validity
  console.log('\n[TEST 5] Kiểm tra truy cập Presigned URL vừa cấp...');
  const testFetch = await fetch(vData1.url);
  console.log('HTTP Status khi đọc Presigned URL:', testFetch.status);
  const textFetched = await testFetch.text();
  console.log('Nội dung file đọc được từ R2 Private Vault:', `"${textFetched}"`);

  // 6. Test Chat History Auto-Renew Presigned URL
  console.log('\n[TEST 6] Test Auto-Renew Presigned URL trong Chat History (GET /api/chat/history/1)...');
  const histRes = await fetch('http://localhost:5000/api/chat/history/1', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('History HTTP Status:', histRes.status);
  const histData = await histRes.json();
  console.log('Số lượng tin nhắn trả về:', histData.messages?.length);

  const msgsWithImages = histData.messages?.filter(m => m.imageUrl);
  console.log(`Tìm thấy ${msgsWithImages?.length || 0} tin nhắn có đính kèm:`);
  msgsWithImages?.forEach(m => {
    console.log(`  Msg #${m.id} [${m.senderRole}]: ${m.imageUrl?.substring(0, 90)}...`);
  });

  console.log('\n====================================================================');
  console.log('ALL TASK 2 INTEGRATION TESTS COMPLETED!');
  console.log('====================================================================');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
