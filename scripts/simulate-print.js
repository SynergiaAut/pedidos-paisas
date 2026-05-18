const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulatePrint() {
    console.log('🖨️  Simulating print job from Millennium software...');

    const productsList = [
        { name: "Hamburguesa Doble", price: 22000, type: "DIAN" },
        { name: "Perro Caliente", price: 18000, type: "DIAN" },
        { name: "Mazorcada Mixta", price: 25000, type: "DIAN" },
        { name: "Gaseosa 1.5L", price: 8000, type: "INTERNAL" },
        { name: "Papas Fritas", price: 7000, type: "INTERNAL" },
        { name: "Jugo Natural", price: 6000, type: "INTERNAL" },
        { name: "Cerveza Club", price: 5500, type: "INTERNAL" }
    ];

    const selectedProducts = [];
    const numProducts = Math.floor(Math.random() * 4) + 1; // 1 to 4 products

    let totalValue1 = 0;
    let totalValue2 = 0;

    for (let i = 0; i < numProducts; i++) {
        const prod = productsList[Math.floor(Math.random() * productsList.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        selectedProducts.push({ name: prod.name, qty, price: prod.price, type: prod.type });

        if (prod.type === "DIAN") totalValue1 += (prod.price * qty);
        else totalValue2 += (prod.price * qty);
    }

    const invoiceData = {
        invoice_number_1: `FE-${Math.floor(Math.random() * 10000)}`, // DIAN Invoice
        invoice_value_1: totalValue1,
        invoice_number_2: totalValue2 > 0 ? `INT-${Math.floor(Math.random() * 10000)}` : null, // Internal Invoice
        invoice_value_2: totalValue2,
        products: selectedProducts,
        status: 'PENDING'
    };

    const { data, error } = await supabase
        .from('invoice_events')
        .insert(invoiceData)
        .select()
        .single();

    if (error) {
        console.error('❌ Error simulating print:', error.message);
    } else {
        console.log('✅ Print event success!');
        console.log('   ID:', data.id);
        console.log('   Invoices:', `${data.invoice_number_1} / ${data.invoice_number_2}`);
        console.log('   Status:', data.status);
        console.log('\n👀 Check your "Pedidos" page now for the popup!');
    }
}

simulatePrint();
