const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function fixAuth() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Check if user exists
    const userResult = await client.query(
      'SELECT id, email, name, role, "isActive", password FROM "User" WHERE email = $1',
      ['heathjansse@gmail.com']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found - creating new user');
      
      // Create new user with hashed password
      const hashedPassword = await bcrypt.hash('Nintendo:)2100w', 10);
      
      await client.query(
        'INSERT INTO "User" (email, name, role, "isActive", password) VALUES ($1, $2, $3, $4, $5)',
        ['heathjansse@gmail.com', 'Heath Jansse', 'ADMIN', true, hashedPassword]
      );
      
      console.log('✅ Created new admin user');
    } else {
      const user = userResult.rows[0];
      console.log('👤 User found:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        hasPassword: !!user.password,
        passwordLength: user.password ? user.password.length : 0
      });

      if (!user.isActive) {
        await client.query(
          'UPDATE "User" SET "isActive" = true WHERE id = $1',
          [user.id]
        );
        console.log('✅ Activated user account');
      }

      // Test password verification
      const isValidPassword = await bcrypt.compare('Nintendo:)2100w', user.password);
      console.log('🔐 Password check:', isValidPassword ? '✅ Valid' : '❌ Invalid');

      if (!isValidPassword) {
        console.log('🔧 Updating password...');
        const newHashedPassword = await bcrypt.hash('Nintendo:)2100w', 10);
        
        await client.query(
          'UPDATE "User" SET password = $1 WHERE id = $2',
          [newHashedPassword, user.id]
        );
        
        console.log('✅ Password updated');
      }
    }

    console.log('🎉 Authentication fix completed successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixAuth();