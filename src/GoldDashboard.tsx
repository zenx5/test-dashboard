import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, Package, BarChart3 } from 'lucide-react';

interface Transaction {
  id: string;
  fecha: string;
  hora: string;
  nombre: string;
  descripcion: string;
  tipoMovimiento: string;
  ingreso: string;
  egreso: string;
  saldo: string;
  telefono: string;
  parsed: {
    pesoGr: number;
    precioUnitario: number;
    total: number;
  } | null;
}

const GoldDashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/src/doc/manteco/flujo_caja.csv');
        const csvText = await response.text();
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        const data: Transaction[] = (parsed.data as Record<string, string>[]).map((row: Record<string, string>) => ({
          id: row.ID,
          fecha: row.FECHA,
          hora: row.HORA,
          nombre: row.NOMBRE,
          descripcion: row.DESCRIPCION,
          tipoMovimiento: row['TIPO DE MOVIMIENTO'],
          ingreso: row.INGRESO,
          egreso: row.EGRESO,
          saldo: row.SALDO,
          telefono: row['NUMERO DE TELEFONO'],
          parsed: parseDescription(row.DESCRIPCION)
        }));
        setTransactions(data);
      } catch (error) {
        console.error('Error loading CSV:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const parseDescription = (desc: string): { pesoGr: number; precioUnitario: number; total: number } | null => {
    // Regex para patrones como "0,97GR * 124$ = 120$" o variaciones
    const regex = /(\d+,\d+|\d+)\s*(GR|PTS|PTOS|GRS|GE)\s*\*?\s*(\d+(?:,\d+)?)\s*\$?\s*=?\s*(\d+(?:,\d+)?)\s*\$?/i;
    const match = desc.match(regex);
    if (!match) return null;

    let peso = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toUpperCase();
    const precio = parseFloat(match[3].replace(',', '.'));
    const total = parseFloat(match[4].replace(',', '.'));

    // Convertir a gramos
    if (unit === 'PTS' || unit === 'PTOS') {
      peso /= 100;
    }

    return { pesoGr: peso, precioUnitario: precio, total };
  };

  if (loading) return <div className="text-white">Cargando...</div>;

  // Filtrar transacciones de compra (PAGO AMALGAMADO)
  const purchaseTransactions = transactions.filter(t => t.tipoMovimiento === 'PAGO AMALGAMADO' && t.parsed);

  // Calcular KPIs
  const totalInventory = purchaseTransactions.reduce((sum, t) => sum + (t.parsed?.pesoGr || 0), 0);
  const totalPaid = purchaseTransactions.reduce((sum, t) => sum + (t.parsed?.total || 0), 0);
  const avgPrice = totalInventory > 0 ? totalPaid / totalInventory : 0;

  // Último saldo
  const lastTransaction = transactions[transactions.length - 1];
  const currentCash = parseFloat(lastTransaction?.saldo.replace('$', '').replace(',', '').replace('.', '') || '0');

  // Datos para gráfico de líneas (saldo por fecha)
  const balanceData = transactions
    .filter(t => t.saldo)
    .map(t => ({
      fecha: t.fecha,
      saldo: parseFloat(t.saldo.replace('$', '').replace(',', '').replace('.', '') || '0')
    }))
    .reduce((acc: { fecha: string; saldo: number }[], curr) => {
      const existing = acc.find(item => item.fecha === curr.fecha);
      if (existing) {
        existing.saldo = curr.saldo; // Último saldo del día
      } else {
        acc.push(curr);
      }
      return acc;
    }, []);

  // Datos para gráfico de barras (gramos por fecha)
  const volumeData = purchaseTransactions
    .reduce((acc: { fecha: string; gramos: number }[], t) => {
      const existing = acc.find(item => item.fecha === t.fecha);
      if (existing) {
        existing.gramos += t.parsed?.pesoGr || 0;
      } else {
        acc.push({ fecha: t.fecha, gramos: t.parsed?.pesoGr || 0 });
      }
      return acc;
    }, []);

  // Últimas transacciones para tabla
  const recentTransactions = purchaseTransactions.slice(-10).reverse();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold text-amber-500 mb-8">Dashboard Manteco (muestra)</h1>

      {/* KPI Cards */}
      <div className="flex flex-row justify-between gap-6 my-10">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex flex-col items-center">
            <Package className="text-amber-500 mr-3" size={32} />
            <div>
              <p className="text-gray-400">Inventario Total</p>
              <p className="text-2xl font-bold">{totalInventory.toFixed(2)} GR</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex flex-col items-center">
            <DollarSign className="text-amber-500 mr-3" size={32} />
            <div>
              <p className="text-gray-400">Efectivo en Caja</p>
              <p className="text-2xl font-bold">${currentCash.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex flex-col items-center">
            <TrendingUp className="text-amber-500 mr-3" size={32} />
            <div>
              <p className="text-gray-400">Precio Promedio</p>
              <p className="text-2xl font-bold">${avgPrice.toFixed(2)}/GR</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex flex-col items-center">
            <BarChart3 className="text-amber-500 mr-3" size={32} />
            <div>
              <p className="text-gray-400">Total Pagado</p>
              <p className="text-2xl font-bold">${totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-amber-500 mb-4">Flujo de Caja</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="fecha" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
              <Line type="monotone" dataKey="saldo" stroke="#F59E0B" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-amber-500 mb-4">Volumen Comprado</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="fecha" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
              <Bar dataKey="gramos" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de Operaciones */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-amber-500 mb-4">Últimas Transacciones</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Descripción</th>
                <th className="pb-2">Peso (GR)</th>
                <th className="pb-2">Monto ($)</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((t, index) => (
                <tr key={index} className="border-b border-gray-700">
                  <td className="py-2">{t.nombre}</td>
                  <td className="py-2">{t.descripcion}</td>
                  <td className="py-2">{t.parsed?.pesoGr.toFixed(2)}</td>
                  <td className="py-2">${t.parsed?.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GoldDashboard;