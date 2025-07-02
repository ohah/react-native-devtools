const fs = require('fs-extra')
const path = require('path')

async function copyDevTools() {
  const sourceDir = path.join(__dirname, '../node_modules/chrome-devtools-frontend/front_end')
  const destDir = path.join(__dirname, '../public/devtools/front_end')

  try {
    // Remove existing directory
    await fs.remove(destDir)

    // Copy the entire front_end directory
    await fs.copy(sourceDir, destDir)

    console.log('✅ Chrome DevTools files copied successfully!')
    console.log(`Source: ${sourceDir}`)
    console.log(`Destination: ${destDir}`)
  } catch (error) {
    console.error('❌ Error copying DevTools files:', error)
  }
}

copyDevTools()
