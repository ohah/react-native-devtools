const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');

const downloadUrl = 'https://github.com/jhen0409/devtools-frontend/releases/download/v0.1.2/devtools-frontend.zip';
const destDir = path.resolve(__dirname, '../public/devtools');
const zipFilePath = path.join(destDir, 'devtools-frontend.zip');

async function downloadAndExtractDevTools() {
  console.log('Downloading DevTools frontend...');
  // Ensure the destination directory exists
  await fs.ensureDir(destDir);

  const file = fs.createWriteStream(zipFilePath);
  https.get(downloadUrl, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(async () => {
        console.log('Download complete. Extracting...');
        try {
          const zip = new AdmZip(zipFilePath);
          zip.extractAllTo(destDir, /*overwrite*/ true);
          console.log('Extraction complete. Cleaning up...');
          await fs.remove(zipFilePath);
          console.log('DevTools frontend installed successfully.');
        } catch (err) {
          console.error('Error during extraction or cleanup:', err);
          process.exit(1);
        }
      });
    });
  }).on('error', function(err) {
    fs.unlink(zipFilePath, () => {}); // Delete the file async
    console.error('Error during download:', err.message);
    process.exit(1);
  });
}

downloadAndExtractDevTools();
