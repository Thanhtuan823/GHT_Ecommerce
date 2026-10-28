/**
 * Migration Script: Migrate Product Images to Cloudflare R2 & Sync Database
 * 
 * Target:
 * 1. Upload 13 physical images from public/images/ to Cloudflare R2 Bucket 'ght-products-public' (Key: images/{fileName})
 * 2. Update PostgreSQL 'Products' table: convert /images/{fileName} -> https://pub-ead62bf4fa7a4393b078968b9a71d0d7.r2.dev/images/{fileName}
 *    Fallback /images/test.png to /images/premium.png CDN URL.
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Client } = require('pg');

// 1. R2 Configurations
const R2_CONFIG = {
  accountId: '8b882fbcae17383b8135712fc723c8a4',
  accessKeyId: 'a16368a91e46f5c5e1e09ee610018b7c',
  secretAccessKey: 'e3d99f5cf6fef18f3d91cc2f8cfe08ea8ba16f955b6e42aa921055ab95cffb15',
  publicBucketName: 'ght-products-public',
  publicBaseUrl: 'https://pub-ead62bf4fa7a4393b078968b9a71d0d7.r2.dev',
  endpoint: 'https://8b882fbcae17383b8135712fc723c8a4.r2.cloudflarestorage.com'
};

// 2. Database Configurations
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'qtdl1234',
  database: 'GHT_Ecom'
};

async function migrate() {
  console.log('====================================================================');
  console.log('BẮT ĐẦU MIGRATION ẢNH SẢN PHẨM LÊN CLOUDFLARE R2 & ĐỒNG BỘ CSDL');
  console.log('====================================================================\n');

  // Khởi tạo S3 Client cho Cloudflare R2
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: R2_CONFIG.endpoint,
    credentials: {
      accessKeyId: R2_CONFIG.accessKeyId,
      secretAccessKey: R2_CONFIG.secretAccessKey
    }
  });

  // Đường dẫn thư mục ảnh cục bộ
  const imagesDir = path.resolve(__dirname, '../../public/images');
  if (!fs.existsSync(imagesDir)) {
    throw new Error(`Thư mục ảnh không tồn tại: ${imagesDir}`);
  }

  // Quét danh sách file trong public/images
  const files = fs.readdirSync(imagesDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  console.log(`[BƯỚC 1] Tìm thấy ${files.length} tệp ảnh vật lý trong public/images:`);
  files.forEach((f, i) => {
    const stat = fs.statSync(path.join(imagesDir, f));
    console.log(`  ${i + 1}. ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  });

  console.log('\n[BƯỚC 2] Tiến hành upload ảnh lên Cloudflare R2 (Bucket: ' + R2_CONFIG.publicBucketName + ')...');
  let uploadSuccessCount = 0;

  for (const file of files) {
    const filePath = path.join(imagesDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const key = `images/${file}`;
    const contentType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';

    process.stdout.write(`  -> Đang tải lên: ${key} ... `);
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.publicBucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000'
      }));
      uploadSuccessCount++;
      console.log('✓ THÀNH CÔNG');
    } catch (err) {
      console.log('✗ THẤT BẠI: ' + err.message);
      throw err;
    }
  }

  console.log(`\n=> Hoàn tất upload: ${uploadSuccessCount}/${files.length} ảnh đã sẵn sàng trên R2.`);

  // BƯỚC 3: Cập nhật PostgreSQL
  console.log('\n[BƯỚC 3] Kết nối PostgreSQL để đồng bộ bảng Products...');
  const pgClient = new Client(DB_CONFIG);
  await pgClient.connect();
  console.log('✓ Kết nối database GHT_Ecom thành công.');

  try {
    const res = await pgClient.query('SELECT "Id", "Name", "Images" FROM "Products" ORDER BY "Id"');
    console.log(`Tìm thấy ${res.rows.length} sản phẩm cần rà soát/cập nhật:\n`);

    let updatedCount = 0;
    for (const row of res.rows) {
      const currentImages = row.Images || [];
      const newImages = currentImages.map(img => {
        if (!img) return img;
        if (img.startsWith('http://') || img.startsWith('https://')) {
          return img; // Đã là tuyệt đối
        }
        if (img.startsWith('/images/')) {
          const fileName = img.replace(/^\/images\//, '');
          // Kiểm tra file test.png không tồn tại
          if (fileName === 'test.png' && !files.includes('test.png')) {
            console.log(`  [Fallback] SP #${row.Id} (${row.Name}): ${img} -> Fallback ${R2_CONFIG.publicBaseUrl}/images/premium.png`);
            return `${R2_CONFIG.publicBaseUrl}/images/premium.png`;
          }
          return `${R2_CONFIG.publicBaseUrl}/images/${fileName}`;
        }
        return img;
      });

      const isChanged = JSON.stringify(currentImages) !== JSON.stringify(newImages);
      if (isChanged) {
        await pgClient.query('UPDATE "Products" SET "Images" = $1 WHERE "Id" = $2', [newImages, row.Id]);
        console.log(`  ✓ Đã cập nhật SP #${row.Id} - "${row.Name}":`);
        console.log(`     Cũ: ${JSON.stringify(currentImages)}`);
        console.log(`     Mới: ${JSON.stringify(newImages)}`);
        updatedCount++;
      } else {
        console.log(`  - SP #${row.Id} - "${row.Name}": Đã đúng định dạng, không cần đổi.`);
      }
    }

    console.log(`\n=> Cập nhật thành công ${updatedCount}/${res.rows.length} sản phẩm trong PostgreSQL.`);

    // Kiểm tra đối soát sau khi cập nhật
    console.log('\n[BƯỚC 4] Đối soát kết quả sau migration:');
    const verifyRes = await pgClient.query('SELECT "Id", "Name", "Images" FROM "Products" ORDER BY "Id"');
    verifyRes.rows.forEach(r => {
      console.log(`  #${r.Id} [${r.Name}] => ${r.Images?.[0]}`);
    });

  } finally {
    await pgClient.end();
  }

  console.log('\n====================================================================');
  console.log('MIGRATION THÀNH CÔNG VÀ HOÀN TẤT AN TOÀN!');
  console.log('====================================================================');
}

migrate().catch(err => {
  console.error('\n✗ LỖI MIGRATION:', err);
  process.exit(1);
});
