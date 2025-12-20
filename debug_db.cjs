
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ltazkoefzqhtgvygehzb.supabase.co';
const supabaseKey = 'sb_publishable_CifIhL1em3Iqx4Wc2eEh6w_Ml-ZFiSe';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking tasks table schema...');
    
    // Insert a dummy task with all fields we expect
    const dummyTask = {
        text: 'Schema Test Task',
        // We suspect due_date might be named differently or not exist
        // due_date: new Date().toISOString() 
    };

    // First, just get one row to see keys
    const { data: fetchResult, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .limit(1);

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
    } else {
        if (fetchResult.length > 0) {
            console.log('Existing Keys:', Object.keys(fetchResult[0]));
        } else {
            console.log('No tasks found. Trying to insert to verify columns...');
        }
    }
    
    // Try to insert with due_date
    const { data: insertData, error: insertError } = await supabase
        .from('tasks')
        .insert([{
            text: 'Test Date Column',
            due_date: new Date().toISOString()
        }])
        .select();

    if (insertError) {
        console.error('Insert Error (likely column missing):', insertError);
    } else {
        console.log('Insert Successful:', insertData);
        // Clean up
        if (insertData && insertData[0]) {
            await supabase.from('tasks').delete().eq('id', insertData[0].id);
        }
    }
}

checkSchema();
