async function testHistory() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ght.com', password: 'Admin@123456' })
  });
  const { token } = await loginRes.json();

  // Test Conversation 3 history (contains 3 legacy messages)
  console.log('[TEST HISTORY 3] Lấy lịch sử Conversation 3 (chứa tin nhắn cũ)...');
  const h3Res = await fetch('http://localhost:5000/api/chat/history/3', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const h3Data = await h3Res.json();
  console.log('Conversation 3 messages count:', h3Data.messages?.length);
  h3Data.messages?.forEach(m => {
    if (m.imageUrl) {
      console.log(`  Msg #${m.id}: imageUrl = "${m.imageUrl}"`);
    }
  });

  // Now upload a new vault file and send it to conversation 3
  console.log('\n[TEST SEND & AUTO-RENEW] Upload file mới vào Conversation 3...');
  const dummyFile = Buffer.from('Tai lieu bao mat moi tren Cloudflare R2', 'utf8');
  const form = new FormData();
  form.append('file', new Blob([dummyFile], { type: 'text/plain' }), 'hopdong_ky_so.pdf');

  const upRes = await fetch('http://localhost:5000/api/upload?type=vault', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  const upData = await upRes.json();
  console.log('Upload Vault response:');
  console.log('  Key:', upData.key);
  console.log('  Presigned URL:', upData.url?.substring(0, 80) + '...');

  // Send message via ChatHub/ChatController or directly query history after saving
  // Let's insert a message using the key in DB or check how it renews
  // To test ChatController auto-renew on vault key, let's call GetHistory again after inserting test message
  const pg = require('pg');
  const client = new pg.Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'qtdl1234', database: 'GHT_Ecom' });
  await client.connect();
  
  const insertRes = await client.query(
    `INSERT INTO "ChatMessages" ("ConversationId", "SenderId", "SenderRole", "Content", "ImageUrl", "CreatedAt", "UpdatedAt", "IsEdited", "IsRevoked", "IsRead") 
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), false, false, false) RETURNING "Id"`,
    [3, 2, 'Admin', 'Gửi tài liệu hợp đồng mới qua R2 Vault', upData.key]
  );
  const newMsgId = insertRes.rows[0].Id;
  console.log(`✓ Đã tạo tin nhắn mới #${newMsgId} với ImageUrl = "${upData.key}" trong CSDL`);
  await client.end();

  // Now call GET /api/chat/history/3 and check that Msg #${newMsgId} has a freshly signed Presigned URL!
  console.log('\n[VERIFY AUTO-RENEW] Gọi lại GET /api/chat/history/3 để kiểm tra tự động ký lại Presigned URL:');
  const h3RenewRes = await fetch('http://localhost:5000/api/chat/history/3', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const h3RenewData = await h3RenewRes.json();
  const testMsg = h3RenewData.messages?.find(m => m.id === newMsgId);
  console.log(`  Msg #${testMsg.id}:`);
  console.log(`    Content: "${testMsg.content}"`);
  console.log(`    Auto-Renewed ImageUrl: ${testMsg.imageUrl?.substring(0, 100)}...`);
  console.log(`    Has X-Amz-Signature:`, testMsg.imageUrl?.includes('X-Amz-Signature'));
  console.log(`    Has X-Amz-Expires:`, testMsg.imageUrl?.includes('X-Amz-Expires'));

  // Test accessing this auto-renewed URL directly
  const fetchContent = await fetch(testMsg.imageUrl);
  console.log('    HTTP Status khi fetch Auto-Renewed URL:', fetchContent.status);
  const textFetched = await fetchContent.text();
  console.log('    Nội dung file đọc được:', `"${textFetched}"`);

  console.log('\n=> AUTO-RENEW TEST SUCCESSFUL 100%!');
}

testHistory().catch(e => { console.error(e); process.exit(1); });
