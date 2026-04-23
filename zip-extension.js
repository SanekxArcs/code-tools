#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const manifestPath = path.join(__dirname, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
    console.error('Error: manifest.json not found');
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;
const zipName = `code-tools-v${version}.zip`;

const inclusions = [
    'manifest.json',
    'popup.html',
    'popup.js',
    'copy-content.js',
    'copy-content.css',
    'ace-bridge.js',
    'ace-page.js',
    'ace-ext-beautify.js',
    'icons',
];

const missing = inclusions.filter(f => !fs.existsSync(path.join(__dirname, f)));
if (missing.length > 0) {
    console.warn('Warning: The following files are missing and will be skipped:', missing.join(', '));
}

const filteredInclusions = inclusions.filter(f => fs.existsSync(path.join(__dirname, f)));

console.log(`Zipping version ${version} into ${zipName}...`);

try {
    try {
        execSync('zip -v', { stdio: 'ignore' });
        const cmd = `zip -r "${zipName}" ${filteredInclusions.join(' ')}`;
        execSync(cmd, { stdio: 'inherit' });
        console.log(`\nSuccess! Created ${zipName}`);
    } catch (zipError) {
        console.log('Zip utility not found, falling back to tar...');
        const tarName = zipName.replace('.zip', '.tar.gz');
        const cmd = `tar -czf "${tarName}" ${filteredInclusions.join(' ')}`;
        execSync(cmd, { stdio: 'inherit' });
        console.log(`\nSuccess! Created ${tarName} (using tar fallback)`);
    }
} catch (e) {
    console.error('\nError: Failed to create archive.');
    process.exit(1);
}
