// Test the exact UPDATE scenario Heath is experiencing

const staffId = "cmm2rmoy20002q601rjh6qmj1";  // Real staff ID
const baseUrl = "https://wild-octave-august-production-a54e.up.railway.app";

async function testStaffUpdate() {
    console.log("Testing staff phone update...");
    
    // First, let's see current state
    const beforeResponse = await fetch(`${baseUrl}/api/debug/db-schema`);
    const beforeData = await beforeResponse.json();
    const beforeStaff = beforeData.database.staffWithPhones;
    console.log("Before update:", beforeStaff);
    
    // Now test updating this staff member with a phone number
    // Simulating the exact payload the frontend would send
    const updatePayload = {
        id: staffId,
        name: "Test Staff Update",
        role: "Kitchen",
        baseHourlyRate: 25.5,
        email: null,  // This is what frontend sends for empty email
        phone: "0412345678",  // Add phone number
        isActive: true
    };
    
    console.log("Sending UPDATE with:", JSON.stringify(updatePayload, null, 2));
    
    const updateResponse = await fetch(`${baseUrl}/api/roster/staff`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
    });
    
    const updateResult = await updateResponse.json();
    console.log("Update result:", updateResult);
    
    // Check if it persisted
    const afterResponse = await fetch(`${baseUrl}/api/debug/db-schema`);
    const afterData = await afterResponse.json();
    const afterStaff = afterData.database.staffWithPhones;
    console.log("After update:", afterStaff);
    
    // Test the problematic scenario - editing with empty phone
    console.log("\n--- Testing empty phone edit (the bug scenario) ---");
    
    const emptyPhonePayload = {
        id: staffId,
        name: "Test Staff Update 2",
        role: "Kitchen",
        baseHourlyRate: 26.0,
        email: null,
        phone: null,  // This is the problem - frontend sends null for empty
        isActive: true
    };
    
    console.log("Sending UPDATE with empty phone:", JSON.stringify(emptyPhonePayload, null, 2));
    
    const emptyUpdateResponse = await fetch(`${baseUrl}/api/roster/staff`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emptyPhonePayload)
    });
    
    const emptyUpdateResult = await emptyUpdateResponse.json();
    console.log("Empty phone update result:", emptyUpdateResult);
    
    // Check final state
    const finalResponse = await fetch(`${baseUrl}/api/debug/db-schema`);
    const finalData = await finalResponse.json();
    const finalStaff = finalData.database.staffWithPhones;
    console.log("Final state:", finalStaff);
}

testStaffUpdate().catch(console.error);