const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { autoSeedIfEmpty } = require('../config/db');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/INTERNSHIP_TASK3';

async function runSeed() {
  try {
    console.log('🌱 Starting manual database seed script...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas');

    // Force re-seed: optional clean or autoSeed
    await autoSeedIfEmpty();
    console.log('✅ Seeding completed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

runSeed();
