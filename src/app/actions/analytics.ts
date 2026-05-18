'use server';

import { createClient } from '@/utils/supabase/server';
import type { DailySalesData, RevenueComparison, TopProduct, DeliveryTypeBreakdown, DriverPerformance, MetricsSummary } from '@/types/crm';

/**
 * Analytics Server Actions - Fixed async/await pattern
 */

// ============================================================
// SALES ANALYTICS
// ============================================================

export async function getDailySales(startDate: string, endDate: string) {
    const supabase = await createClient();

    // Generate full date range
    const dates: Record<string, DailySalesData> = {};
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Create query end date that covers the full last day
    const queryEndDate = new Date(endDate);
    queryEndDate.setHours(23, 59, 59, 999);
    const queryEndStr = queryEndDate.toISOString();

    // Adjust end date to include the full day (if it's just a date string)
    // If endDate is "2026-02-08", we want to include entries up to "2026-02-08 23:59:59"
    // The query .lte() handles this if the input is correct, but let's ensure loop covers it.

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dates[dateStr] = {
            date: dateStr,
            total_orders: 0,
            total_revenue: 0,
            delivered_orders: 0,
            delivered_revenue: 0
        };
    }

    const { data, error } = await supabase
        .from('orders')
        .select('created_at, total_value, status')
        .gte('created_at', startDate)
        .lte('created_at', queryEndStr)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching daily sales:', error);
        throw error;
    }

    // Group by date (handling timezone offset roughly by using split('T')[0] on the ISO string which is UTC)
    // If the user wants local time aggregation, we might need a more complex approach.
    // For now, assuming standard ISO strings from DB.

    (data || []).forEach((order) => {
        // Fix: Use local date string if possible, or consistent UTC.
        // If order.created_at is UTC "2026-02-08T19:00:00Z" (which is 2pm local), 
        // split('T')[0] gives "2026-02-08". This is correct for the server's perspective.
        // We just need to make sure the chart uses the same convention.

        // However, if we want to support "Today" correctly when it's late in the day UTC but still today locally.
        // Safe parsing of date string
        let date = '';
        try {
            // If it's a full ISO string, taking the first part works for UTC dates
            // For local time accuracy, we should parse and adjust, but for now consistent UTC buckets is better than gaps
            date = order.created_at.split('T')[0];
        } catch (e) {
            // Fallback
            date = new Date(order.created_at).toISOString().split('T')[0];
        }

        if (dates[date]) {
            dates[date].total_orders += 1;
            dates[date].total_revenue += Number(order.total_value) || 0;

            if (order.status === 'ENTREGADO') {
                dates[date].delivered_orders += 1;
                dates[date].delivered_revenue += Number(order.total_value) || 0;
            }
        }
    });

    return Object.values(dates).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRevenueComparison(currentStart: string, currentEnd: string, previousStart: string, previousEnd: string): Promise<RevenueComparison> {
    const supabase = await createClient();

    const [currentData, previousData] = await Promise.all([
        supabase
            .from('orders')
            .select('total_value, status')
            .gte('created_at', currentStart)
            .lte('created_at', currentEnd),
        supabase
            .from('orders')
            .select('total_value, status')
            .gte('created_at', previousStart)
            .lte('created_at', previousEnd)
    ]);

    if (currentData.error || previousData.error) {
        console.error('Error fetching revenue comparison:', currentData.error || previousData.error);
        throw currentData.error || previousData.error;
    }

    const currentTotal = (currentData.data || []).reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);
    const currentDelivered = (currentData.data || []).filter((o: any) => o.status === 'ENTREGADO').reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);

    const previousTotal = (previousData.data || []).reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);
    const previousDelivered = (previousData.data || []).filter((o: any) => o.status === 'ENTREGADO').reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);

    const percentageChange = previousTotal > 0
        ? ((currentTotal - previousTotal) / previousTotal) * 100
        : 0;

    return {
        current_period: {
            total_revenue: currentTotal,
            delivered_revenue: currentDelivered,
            total_orders: currentData.data?.length || 0
        },
        previous_period: {
            total_revenue: previousTotal,
            delivered_revenue: previousDelivered,
            total_orders: previousData.data?.length || 0
        },
        percentage_change: percentageChange
    };
}

// ============================================================
// PRODUCTS ANALYTICS
// ============================================================

export async function getTopProducts(startDate: string, endDate: string, limit = 10): Promise<TopProduct[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('orders')
        .select('invoices_data, total_value, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('status', 'ENTREGADO');

    if (error) {
        console.error('Error fetching top products:', error);
        return [];
    }

    // Parse invoices and count products
    const productStats: Record<string, TopProduct> = {};

    (data || []).forEach((order: any) => {
        const invoices = order.invoices_data || [];
        invoices.forEach((invoice: any) => {
            const productName = invoice.product_name || 'Sin nombre';
            const quantity = Number(invoice.quantity) || 0;
            const price = Number(invoice.price) || 0;

            if (!productStats[productName]) {
                productStats[productName] = {
                    product_name: productName,
                    total_quantity: 0,
                    total_revenue: 0,
                    order_count: 0
                };
            }

            productStats[productName].total_quantity += quantity;
            productStats[productName].total_revenue += quantity * price;
            productStats[productName].order_count += 1;
        });
    });

    return Object.values(productStats)
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, limit);
}

// ============================================================
// DELIVERY ANALYTICS
// ============================================================

export async function getDeliveryTypeBreakdown(startDate: string, endDate: string): Promise<DeliveryTypeBreakdown[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('orders')
        .select('delivery_type, total_value, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    if (error) {
        console.error('Error fetching delivery type breakdown:', error);
        return [];
    }

    const breakdown: Record<string, DeliveryTypeBreakdown> = {};

    (data || []).forEach((order: any) => {
        const type = order.delivery_type || 'SIN_TIPO';

        if (!breakdown[type]) {
            breakdown[type] = {
                delivery_type: type,
                total_orders: 0,
                total_revenue: 0,
                delivered_orders: 0
            };
        }

        breakdown[type].total_orders += 1;
        breakdown[type].total_revenue += Number(order.total_value) || 0;

        if (order.status === 'ENTREGADO') {
            breakdown[type].delivered_orders += 1;
        }
    });

    return Object.values(breakdown);
}

export async function getDriverPerformance(startDate: string, endDate: string): Promise<DriverPerformance[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('orders')
        .select(`
      driver_id,
      total_value,
      status,
      delivery_drivers (
        id,
        full_name
      )
    `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('driver_id', 'is', null);

    if (error) {
        console.error('Error fetching driver performance:', error);
        return [];
    }

    const driverStats: Record<string, DriverPerformance> = {};

    (data || []).forEach((order: any) => {
        const driverId = order.driver_id;
        const driverName = order.delivery_drivers?.full_name || 'Desconocido';

        if (!driverStats[driverId]) {
            driverStats[driverId] = {
                driver_id: driverId,
                driver_name: driverName,
                total_deliveries: 0,
                completed_deliveries: 0,
                total_revenue: 0
            };
        }

        driverStats[driverId].total_deliveries += 1;
        driverStats[driverId].total_revenue += Number(order.total_value) || 0;

        if (order.status === 'ENTREGADO') {
            driverStats[driverId].completed_deliveries += 1;
        }
    });

    return Object.values(driverStats)
        .sort((a, b) => b.completed_deliveries - a.completed_deliveries);
}

// ============================================================
// DASHBOARD SUMMARY
// ============================================================

export async function getMetricsSummary(startDate: string, endDate: string): Promise<MetricsSummary> {
    const supabase = await createClient();

    const [ordersData, clientsData, dailyMetricsData] = await Promise.all([
        supabase
            .from('orders')
            .select('total_value, status')
            .gte('created_at', startDate)
            .lte('created_at', endDate),
        supabase
            .from('clients')
            .select('id')
            .gte('created_at', startDate)
            .lte('created_at', endDate),
        supabase
            .rpc('calculate_daily_metrics', {
                p_start_date: startDate,
                p_end_date: endDate
            })
    ]);

    const orders = ordersData.data || [];
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter((o: any) => o.status === 'ENTREGADO').length;
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);
    const deliveredRevenue = orders.filter((o: any) => o.status === 'ENTREGADO').reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const newClients = clientsData.data?.length || 0;

    return {
        total_orders: totalOrders,
        delivered_orders: deliveredOrders,
        total_revenue: totalRevenue,
        delivered_revenue: deliveredRevenue,
        average_order_value: averageOrderValue,
        new_clients: newClients
    };
}

// ============================================================
// ADVANCED CLIENT ANALYTICS
// ============================================================

export async function getTopClients(startDate: string, endDate: string, limit = 10) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('orders')
        .select(`
            client_id,
            total_value,
            status,
            created_at,
            client_name,
            clients:client_id (
                id,
                full_name,
                phone
            )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('status', 'ENTREGADO');

    if (error) {
        console.error('Error fetching top clients:', error);
        return [];
    }

    const clientStats: Record<string, any> = {};

    (data || []).forEach((order: any) => {
        // Safe access to client data
        const clientId = order.client_id || 'unknown';
        // Fallback hierarchy: Link -> Order Fallback -> Default
        let clientName = order.clients?.full_name || order.client_name;

        let phone = order.clients?.phone;

        // Group anonymous/unlinked orders
        if (clientId === 'unknown' && !clientName) {
            clientName = 'Cliente Ocasional';
        } else if (!clientName) {
            clientName = 'Sin Nombre';
        }

        if (!clientStats[clientId]) {
            clientStats[clientId] = {
                client_id: clientId,
                client_name: clientName,
                total_orders: 0,
                total_revenue: 0,
                last_order_date: order.created_at,
                phone: phone
            };
        }

        clientStats[clientId].total_orders += 1;
        clientStats[clientId].total_revenue += Number(order.total_value) || 0;

        if (new Date(order.created_at) > new Date(clientStats[clientId].last_order_date)) {
            clientStats[clientId].last_order_date = order.created_at;
        }
    });

    return Object.values(clientStats)
        .map((client: any) => ({
            ...client,
            average_order_value: client.total_revenue / client.total_orders
        }))
        .sort((a: any, b: any) => b.total_revenue - a.total_revenue)
        .slice(0, limit);
}

// ============================================================
// TEMPORAL PATTERN ANALYTICS
// ============================================================

export async function getWeekdayPatterns(startDate: string, endDate: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('orders')
        .select('created_at, total_value, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('status', 'ENTREGADO');

    if (error) {
        console.error('Error fetching weekday patterns:', error);
        return [];
    }

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const weekdayStats: Record<number, any> = {};

    // Initialize all days
    for (let i = 0; i < 7; i++) {
        weekdayStats[i] = {
            day_number: i,
            day_name: dayNames[i],
            total_orders: 0,
            total_revenue: 0
        };
    }

    (data || []).forEach((order: any) => {
        const dayNumber = new Date(order.created_at).getDay();
        weekdayStats[dayNumber].total_orders += 1;
        weekdayStats[dayNumber].total_revenue += Number(order.total_value) || 0;
    });

    return Object.values(weekdayStats).map((day: any) => ({
        ...day,
        average_order_value: day.total_orders > 0 ? day.total_revenue / day.total_orders : 0
    }));
}

export async function getMonthlyTrends(startDate: string, endDate: string) {
    const supabase = await createClient();

    // Determine the year from the startDate or endDate to generate the full year view
    // Default to current year if range crosses years or is ambiguous, but usually for "Monthly Trends" 
    // users expect to see the current year's progression.
    const start = new Date(startDate);
    const year = start.getFullYear();

    // Generate all 12 months for the specific year
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyStats: Record<string, any> = {};

    for (let i = 0; i < 12; i++) {
        const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
        monthlyStats[monthKey] = {
            month: monthKey,
            month_name: `${monthNames[i]} ${year}`,
            total_orders: 0,
            total_revenue: 0,
            new_clients: 0
        };
    }

    const [ordersData, clientsData] = await Promise.all([
        supabase
            .from('orders')
            .select('created_at, total_value, status')
            .gte('created_at', `${year}-01-01`) // Fetch full year to fill the chart
            .lte('created_at', `${year}-12-31 23:59:59`)
            .eq('status', 'ENTREGADO'),
        supabase
            .from('clients')
            .select('created_at')
            .gte('created_at', `${year}-01-01`)
            .lte('created_at', `${year}-12-31 23:59:59`)
    ]);

    if (ordersData.error) {
        console.error('Error fetching monthly trends:', ordersData.error);
        return [];
    }

    (ordersData.data || []).forEach((order: any) => {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (monthlyStats[monthKey]) {
            monthlyStats[monthKey].total_orders += 1;
            monthlyStats[monthKey].total_revenue += Number(order.total_value) || 0;
        }
    });

    (clientsData.data || []).forEach((client: any) => {
        const date = new Date(client.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (monthlyStats[monthKey]) {
            monthlyStats[monthKey].new_clients += 1;
        }
    });

    return Object.values(monthlyStats)
        .map((month: any) => ({
            ...month,
            average_order_value: month.total_orders > 0 ? month.total_revenue / month.total_orders : 0
        }))
        .sort((a: any, b: any) => a.month.localeCompare(b.month));
}

