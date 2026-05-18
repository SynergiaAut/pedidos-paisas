'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Save, X, User, Mail, Phone, MapPin, Building2, CreditCard, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/actions/crm-mutations';

export default function NewClientPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        email: '',
        address: '',
        document_type: 'CC',
        document_id: '',
        customer_type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
        company_name: '',
        tax_id: '',
        preferred_contact_method: 'PHONE' as 'PHONE' | 'EMAIL' | 'WHATSAPP',
        source: 'DIRECT' as 'DIRECT' | 'AUTO_REGISTRO' | 'REFERRAL' | 'SOCIAL_MEDIA' | 'WEB' | 'PHONE' | 'OTHER',
        credit_limit: 0,
        payment_terms: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await createClient(formData);
            if (result.success) {
                router.push('/crm');
            } else {
                setError(result.error || 'Error al crear cliente');
            }
        } catch (err) {
            setError('Error inesperado al crear cliente');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'credit_limit' ? Number(value) : value
        }));
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b pb-4 pt-4 shadow-sm">
                <div className="container mx-auto max-w-4xl px-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                <User className="w-6 h-6" />
                                Nuevo Cliente
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Registra un nuevo cliente en el sistema
                            </p>
                        </div>
                        <Link
                            href="/crm"
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 shadow-sm"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Link>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="container mx-auto max-w-4xl py-8 px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border bg-card shadow-sm p-6"
                >
                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Tipo de Cliente */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Tipo de Cliente *
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, customer_type: 'INDIVIDUAL' }))}
                                    className={`p-3 rounded-lg border transition-all ${formData.customer_type === 'INDIVIDUAL'
                                        ? 'border-brand bg-brand/10 text-brand'
                                        : 'border-border hover:border-brand/50'
                                        }`}
                                >
                                    <User className="w-5 h-5 mx-auto mb-1" />
                                    <div className="text-xs font-medium">Individual</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, customer_type: 'COMPANY' }))}
                                    className={`p-3 rounded-lg border transition-all ${formData.customer_type === 'COMPANY'
                                        ? 'border-brand bg-brand/10 text-brand'
                                        : 'border-border hover:border-brand/50'
                                        }`}
                                >
                                    <Building2 className="w-5 h-5 mx-auto mb-1" />
                                    <div className="text-xs font-medium">Empresa</div>
                                </button>
                            </div>
                        </div>

                        {/* Información Básica */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="full_name" className="block text-sm font-medium text-foreground mb-2">
                                    Nombre Completo *
                                </label>
                                <input
                                    type="text"
                                    id="full_name"
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all"
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>

                            {formData.customer_type === 'COMPANY' && (
                                <div>
                                    <label htmlFor="company_name" className="block text-sm font-medium text-foreground mb-2">
                                        Nombre de Empresa
                                    </label>
                                    <input
                                        type="text"
                                        id="company_name"
                                        name="company_name"
                                        value={formData.company_name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all"
                                        placeholder="Ej: Mi Empresa S.A.S."
                                    />
                                </div>
                            )}
                        </div>

                        {/* Documento */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="document_type" className="block text-sm font-medium text-foreground mb-2">
                                    Tipo de Documento
                                </label>
                                <select
                                    id="document_type"
                                    name="document_type"
                                    value={formData.document_type}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none cursor-pointer"
                                >
                                    <option value="CC">CC</option>
                                    <option value="CE">CE</option>
                                    <option value="NIT">NIT</option>
                                    <option value="PASSPORT">Pasaporte</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label htmlFor="document_id" className="block text-sm font-medium text-foreground mb-2">
                                    Número de Documento
                                </label>
                                <input
                                    type="text"
                                    id="document_id"
                                    name="document_id"
                                    value={formData.document_id}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all"
                                    placeholder="Ej: 1234567890"
                                />
                            </div>

                            {formData.customer_type === 'COMPANY' && (
                                <div className="md:col-span-3">
                                    <label htmlFor="tax_id" className="block text-sm font-medium text-foreground mb-2">
                                        NIT
                                    </label>
                                    <input
                                        type="text"
                                        id="tax_id"
                                        name="tax_id"
                                        value={formData.tax_id}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all"
                                        placeholder="Ej: 900123456-7"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Contacto */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                                    <Phone className="w-4 h-4 inline mr-1" />
                                    Teléfono *
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all"
                                    placeholder="Ej: 3001234567"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                                    <Mail className="w-4 h-4 inline mr-1" />
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all"
                                    placeholder="Ej: cliente@email.com"
                                />
                            </div>
                        </div>

                        {/* Dirección */}
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-foreground mb-2">
                                <MapPin className="w-4 h-4 inline mr-1" />
                                Dirección
                            </label>
                            <textarea
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all resize-none"
                                placeholder="Ej: Calle 123 #45-67, Medellín"
                            />
                        </div>

                        {/* Preferencias */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="preferred_contact_method" className="block text-sm font-medium text-foreground mb-2">
                                    Método de Contacto Preferido
                                </label>
                                <select
                                    id="preferred_contact_method"
                                    name="preferred_contact_method"
                                    value={formData.preferred_contact_method}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none cursor-pointer"
                                >
                                    <option value="PHONE">Teléfono</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="WHATSAPP">WhatsApp</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="source" className="block text-sm font-medium text-foreground mb-2">
                                    Fuente de Registro
                                </label>
                                <select
                                    id="source"
                                    name="source"
                                    value={formData.source}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none cursor-pointer"
                                >
                                    <option value="DIRECT">Directo (En Tienda)</option>
                                    <option value="AUTO_REGISTRO">Auto Registro (Online)</option>
                                    <option value="REFERRAL">Referido</option>
                                    <option value="SOCIAL_MEDIA">Redes Sociales</option>
                                    <option value="WEB">Sitio Web</option>
                                    <option value="PHONE">Teléfono</option>
                                    <option value="OTHER">Otro</option>
                                </select>
                            </div>
                        </div>

                        {/* Crédito */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="credit_limit" className="block text-sm font-medium text-foreground mb-2">
                                    <CreditCard className="w-4 h-4 inline mr-1" />
                                    Límite de Crédito
                                </label>
                                <input
                                    type="number"
                                    id="credit_limit"
                                    name="credit_limit"
                                    value={formData.credit_limit}
                                    onChange={handleChange}
                                    min="0"
                                    step="1000"
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all"
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label htmlFor="payment_terms" className="block text-sm font-medium text-foreground mb-2">
                                    Términos de Pago
                                </label>
                                <input
                                    type="text"
                                    id="payment_terms"
                                    name="payment_terms"
                                    value={formData.payment_terms}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all"
                                    placeholder="Ej: 30 días"
                                />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end gap-3 pt-4">
                            <Link
                                href="/crm"
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Cancelar
                            </Link>
                            <button
                                type="submit"
                                disabled={loading || !formData.full_name || !formData.phone}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-brand hover:bg-brand/90 text-black font-bold h-10 px-6 shadow-md hover:shadow-lg"
                            >
                                {loading ? (
                                    <>
                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Guardar Cliente
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
