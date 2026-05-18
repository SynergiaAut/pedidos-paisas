'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function registerClient(formData: FormData) {
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const phone = formData.get("phone") as string;
    const documentId = formData.get("documentId") as string;
    const address = formData.get("address") as string;

    if (!firstName || !lastName || !phone) {
        return { success: false, message: "Nombre, apellido y teléfono son obligatorios." };
    }

    // Auto-generate full_name
    const fullName = `${firstName} ${lastName}`.trim().toUpperCase();

    try {
        const supabase = await createClient();

        console.log("Starting registration for:", phone);

        const { data, error } = await supabase
            .from('clients')
            .insert({
                first_name: firstName.toUpperCase(),
                last_name: lastName.toUpperCase(),
                full_name: fullName,
                phone: phone,
                document_id: documentId || null,
                address: address?.toUpperCase() || null,
                source: 'REFERRAL', // Mapped to "Auto-registro" in UI
                status: 'ACTIVE',
                total_orders: 0
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase insert error:", error);
            if (error.code === '23505') {
                return { success: false, message: "Este número de teléfono ya está registrado." };
            }
            throw error;
        }

        console.log("Client created with ID:", data.id);

        // EXTRA SAFETY: Force update source to REFERRAL to be 100% sure
        const updateResult = await supabase
            .from('clients')
            .update({ source: 'REFERRAL' })
            .eq('id', data.id)
            .select();

        console.log("Update result:", updateResult);

        revalidatePath('/crm');
        return { success: true, message: "¡Registro exitoso!" };
    } catch (error: any) {
        console.error("Error registering client:", error);
        return { success: false, message: `Error: ${error.message}` };
    }
}
