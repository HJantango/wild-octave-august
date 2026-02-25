#!/usr/bin/env npx tsx
import { isValidPhoneNumber, normalizePhoneNumber } from './src/lib/sms-service';

// Test various phone formats to see what passes validation
const testNumbers = [
  '0412345678',
  '+61412345678', 
  '61412345678',
  '0412 345 678',
  '(04) 1234 5678',
  '04-1234-5678',
  '+61 412 345 678',
  '0432345678',  // Different prefix
  '0512345678',  // Different prefix
  '0312345678',  // Landline (should fail)
  '1234567890',  // Random number
];

console.log('📱 Testing Phone Number Validation:\n');

testNumbers.forEach(phone => {
  const isValid = isValidPhoneNumber(phone);
  const normalized = isValid ? normalizePhoneNumber(phone) : 'INVALID';
  const status = isValid ? '✅' : '❌';
  console.log(`${status} "${phone}" → ${normalized}`);
});

console.log('\n🔍 If Jackie\'s number is failing validation, try these formats:');
console.log('- 0412345678 (Australian mobile)');
console.log('- +61412345678 (International format)');
console.log('- Must start with 04 or 05 for mobiles');
console.log('\n💡 Common issues:');
console.log('- Landline numbers (02, 03, 07, 08) will fail');
console.log('- International numbers from other countries will fail');
console.log('- Missing or extra digits will fail');