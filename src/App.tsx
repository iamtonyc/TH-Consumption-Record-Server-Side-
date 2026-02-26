import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  History, 
  Wallet,
  Search as SearchIcon,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, type Transaction, type LookupItem } from './supabase';

type SortConfig = {
  key: keyof Transaction;
  direction: 'asc' | 'desc';
};

const FormField = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 py-1.5 border-b border-zinc-50 last:border-0">
    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 shrink-0">
      {label}
    </label>
    <div className="grow">
      {children}
    </div>
  </div>
);

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'input' | 'search'>('input');
  
  // Maintenance Form State
  const [date, setDate] = useState(getLocalDate());
  const [category, setCategory] = useState('');
  const [item, setItem] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [fromAccount, setFromAccount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search Form State
  const [fromDate, setFromDate] = useState(getLocalDate());
  const [toDate, setToDate] = useState(getLocalDate());
  const [searchCategory, setSearchCategory] = useState('');
  const [searchResults, setSearchResults] = useState<Transaction[] | null>(null);

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const itemsPerPage = 10;

  // Data State
  const [categories, setCategories] = useState<LookupItem[]>([]);
  const [accounts, setAccounts] = useState<LookupItem[]>([]);
  const [payers, setPayers] = useState<LookupItem[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
      setError("Supabase configuration is incomplete. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correctly set in the Secrets panel.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('accounts').select('*').order('name'),
        supabase.from('payers').select('*').order('name'),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(100)
      ]);

      const errors = results.filter(r => r.error).map(r => r.error?.message);
      if (errors.length > 0) {
        throw new Error(`Supabase Error: ${errors.join(', ')}`);
      }

      const [catRes, accRes, payRes, transRes] = results;

      if (catRes.data) setCategories(catRes.data);
      if (accRes.data) setAccounts(accRes.data);
      if (payRes.data) setPayers(payRes.data);
      if (transRes.data) setAllTransactions(transRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
      let message = err instanceof Error ? err.message : "An unknown error occurred connecting to Supabase.";
      
      if (message.includes("Failed to fetch")) {
        message = "Network Error: Failed to reach Supabase. This usually means the URL is incorrect, the project is paused, or there is a local network/CORS issue. Please double-check your VITE_SUPABASE_URL in Secrets.";
      }
      
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newTransaction = {
        date,
        category,
        item,
        vendor,
        amount: parseFloat(amount),
        from_account: fromAccount,
        paid_by: paidBy
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert([newTransaction])
        .select();

      if (error) throw error;

      // Update lookup tables if new values are entered
      if (category && !categories.find(c => c.name === category)) {
        await supabase.from('categories').insert([{ name: category }]);
      }
      if (fromAccount && !accounts.find(a => a.name === fromAccount)) {
        await supabase.from('accounts').insert([{ name: fromAccount }]);
      }
      if (paidBy && !payers.find(p => p.name === paidBy)) {
        await supabase.from('payers').insert([{ name: paidBy }]);
      }

      // Refresh data
      fetchData();

      // Reset fields but keep date as current date
      setAmount('');
      setCategory('');
      setItem('');
      setVendor('');
      setFromAccount('');
      setPaidBy('');
      setDate(getLocalDate());
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to add transaction:", error);
      alert("Failed to save record. Please check your Supabase connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: number | undefined) => {
    if (id === undefined) return;
    
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);

        if (error) throw error;

        // Refresh local state
        setAllTransactions(prev => prev.filter(t => t.id !== id));
        if (searchResults) {
          setSearchResults(prev => prev ? prev.filter(t => t.id !== id) : null);
        }
      } catch (error) {
        console.error("Failed to delete transaction:", error);
        alert("Failed to delete record.");
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let query = supabase.from('transactions').select('*');

      if (fromDate) query = query.gte('date', fromDate);
      if (toDate) query = query.lte('date', toDate);
      if (searchCategory) query = query.eq('category', searchCategory);

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      setSearchResults(data);
      setCurrentPage(1);
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!searchResults || searchResults.length === 0) return;

    const headers = ['Date', 'Category', 'Item', 'Vendor', 'Amount', 'Account', 'Paid By'];
    const rows = searchResults.map(t => [
      t.date,
      t.category,
      t.item,
      t.vendor,
      t.amount.toFixed(2),
      t.from_account,
      t.paid_by
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `consumption_records_${getLocalDate()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sortedData = useMemo(() => {
    const data = activeTab === 'input' ? allTransactions : (searchResults || []);
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue === undefined || bValue === undefined) return 0;
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allTransactions, searchResults, sortConfig, activeTab]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const requestSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof Transaction }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr;
  };

  const renderDataGrid = () => (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-zinc-100 overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-zinc-50/50">
              {[
                { label: 'Date', key: 'date' as const },
                { label: 'Category', key: 'category' as const },
                { label: 'Item', key: 'item' as const },
                { label: 'Vendor', key: 'vendor' as const },
                { label: 'Amount', key: 'amount' as const },
                { label: 'Account', key: 'from_account' as const },
                { label: 'Paid By', key: 'paid_by' as const },
                ...(activeTab === 'input' ? [{ label: 'Actions', key: 'id' as const }] : [])
              ].map((col) => (
                <th 
                  key={col.key}
                  onClick={() => col.label && col.label !== 'Actions' && requestSort(col.key)}
                  className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 ${col.label && col.label !== 'Actions' ? 'cursor-pointer hover:bg-zinc-100' : ''} transition-colors`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.label && col.label !== 'Actions' && <SortIcon columnKey={col.key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {isLoading ? (
              <tr>
                <td colSpan={activeTab === 'input' ? 8 : 7} className="px-4 py-12 text-center text-zinc-400">
                  <div className="animate-spin w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full mx-auto mb-2" />
                  <p className="text-xs">Loading...</p>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'input' ? 8 : 7} className="px-4 py-12 text-center text-zinc-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-10" />
                  <p className="text-xs">No transactions found</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((t) => (
                <tr key={t.id} className="active:bg-zinc-50 transition-colors">
                  <td className="px-4 py-4 text-xs font-medium text-zinc-500 whitespace-nowrap">
                    {formatDate(t.date)}
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-zinc-900">{t.category}</td>
                  <td className="px-4 py-4 text-xs text-zinc-600">{t.item}</td>
                  <td className="px-4 py-4 text-xs text-zinc-600">{t.vendor}</td>
                  <td className="px-4 py-4 text-xs font-mono font-bold text-zinc-900">
                    ${t.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-xs text-zinc-500">{t.from_account}</td>
                  <td className="px-4 py-4 text-xs text-zinc-500">{t.paid_by}</td>
                  {activeTab === 'input' && (
                    <td className="px-4 py-4 text-right">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTransaction(t.id);
                        }}
                        className="p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center text-zinc-400 shadow-sm">
            <div className="animate-spin w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full mx-auto mb-2" />
            <p className="text-xs">Loading...</p>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center text-zinc-400 shadow-sm">
            <History className="w-8 h-8 mx-auto mb-2 opacity-10" />
            <p className="text-xs">No transactions found</p>
          </div>
        ) : (
          paginatedData.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3 active:bg-zinc-50 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{formatDate(t.date)}</p>
                  <h4 className="text-sm font-bold text-zinc-900">{t.item}</h4>
                  <p className="text-xs text-zinc-500">{t.vendor}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-zinc-900">${t.amount.toFixed(2)}</p>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
                    {t.category}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-50 flex justify-between items-center text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                <div className="flex gap-4">
                  <span>{t.from_account}</span>
                  <span>{t.paid_by}</span>
                </div>
                {activeTab === 'input' && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTransaction(t.id);
                    }}
                    className="p-2 rounded-lg text-zinc-400 active:text-red-500 active:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-white border border-zinc-200 disabled:opacity-30 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-white border border-zinc-200 disabled:opacity-30 active:scale-95 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const inputClasses = "w-full bg-transparent border-none py-1 px-0 text-xs font-bold focus:ring-0 transition-all placeholder:text-zinc-300";

  const DateInput = ({ value, onChange, required = false }: { value: string, onChange: (val: string) => void, required?: boolean }) => (
    <input 
      type="date"
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClasses + " block w-full cursor-pointer"}
    />
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-12 select-none">
      <div className="h-4 bg-white" />

      <header className="px-6 py-2 bg-white border-b border-zinc-100 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-bold tracking-tight">TH Consumption Record</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
          <Wallet className="w-4 h-4 text-zinc-600" />
        </div>
      </header>

      {/* Top Navigation */}
      <nav className="bg-white border-b border-zinc-100 px-6 py-2 flex items-center gap-6 sticky top-[49px] z-20">
        <button 
          onClick={() => setActiveTab('input')}
          className={`flex items-center gap-2 transition-colors py-1 ${activeTab === 'input' ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-300'}`}
        >
          <Wrench className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-tighter">Input</span>
        </button>

        <button 
          onClick={() => setActiveTab('search')}
          className={`flex items-center gap-2 transition-colors py-1 ${activeTab === 'search' ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-300'}`}
        >
          <SearchIcon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-tighter">Search</span>
        </button>
      </nav>

      <main className="px-4 py-6 max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-6 bg-white border border-red-100 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <p className="font-bold uppercase tracking-tight text-xs">Configuration Required</p>
            </div>
            
            <div className="space-y-3 text-zinc-600">
              <p className="text-sm font-medium text-zinc-900">{error}</p>
              
              <div className="bg-zinc-50 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Setup Instructions:</p>
                <ol className="text-xs space-y-1.5 list-decimal list-inside opacity-80">
                  <li>Go to your <a href="https://supabase.com" target="_blank" className="text-zinc-900 underline">Supabase Dashboard</a></li>
                  <li>Go to <b>Project Settings</b> &gt; <b>API</b></li>
                  <li>Copy <b>Project URL</b> and <b>anon public key</b></li>
                  <li>In AI Studio, open the <b>Secrets</b> panel</li>
                  <li>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code></li>
                </ol>
              </div>
            </div>

            <button 
              onClick={() => fetchData()}
              className="mt-6 w-full py-2.5 bg-zinc-900 text-white rounded-xl font-bold text-xs shadow-lg active:scale-[0.98] transition-all"
            >
              Check Connection Again
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
          {activeTab === 'input' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Input Form */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
                <form onSubmit={handleAddTransaction} className="space-y-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <FormField label="Date">
                      <DateInput 
                        required
                        value={date}
                        onChange={setDate}
                      />
                    </FormField>

                    <FormField label="Category">
                      <input 
                        list="categories-list"
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        onFocus={(e) => {
                          e.target.value = '';
                        }}
                        onBlur={(e) => {
                          if (!e.target.value) setCategory(category);
                        }}
                        placeholder="Select or type..."
                        className={inputClasses}
                        autoComplete="off"
                      />
                      <datalist id="categories-list">
                        {categories.map(c => <option key={c.id} value={c.name} />)}
                      </datalist>
                    </FormField>

                    <FormField label="Item">
                      <input 
                        type="text"
                        required
                        value={item}
                        onChange={(e) => setItem(e.target.value)}
                        placeholder="What did you buy?"
                        className={inputClasses}
                      />
                    </FormField>

                    <FormField label="Vendor">
                      <input 
                        type="text"
                        required
                        value={vendor}
                        onChange={(e) => setVendor(e.target.value)}
                        placeholder="Where?"
                        className={inputClasses}
                      />
                    </FormField>

                    <FormField label="Amount">
                      <div className="relative flex items-center">
                        <span className="text-xs font-bold text-zinc-300 mr-1">$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          required
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className={inputClasses}
                        />
                      </div>
                    </FormField>

                    <FormField label="Account">
                      <input 
                        list="accounts-list"
                        required
                        value={fromAccount}
                        onChange={(e) => setFromAccount(e.target.value)}
                        onFocus={(e) => {
                          e.target.value = '';
                        }}
                        onBlur={(e) => {
                          if (!e.target.value) setFromAccount(fromAccount);
                        }}
                        placeholder="From which account?"
                        className={inputClasses}
                        autoComplete="off"
                      />
                      <datalist id="accounts-list">
                        {accounts.map(a => <option key={a.id} value={a.name} />)}
                      </datalist>
                    </FormField>

                    <FormField label="Paid By">
                      <input 
                        list="payers-list"
                        required
                        value={paidBy}
                        onChange={(e) => setPaidBy(e.target.value)}
                        onFocus={(e) => {
                          e.target.value = '';
                        }}
                        onBlur={(e) => {
                          if (!e.target.value) setPaidBy(paidBy);
                        }}
                        placeholder="Who paid?"
                        className={inputClasses}
                        autoComplete="off"
                      />
                      <datalist id="payers-list">
                        {payers.map(p => <option key={p.id} value={p.name} />)}
                      </datalist>
                    </FormField>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-zinc-900 text-white py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Record'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Data Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-lg">Recent Transactions</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Total: {allTransactions.length}
                  </p>
                </div>
                {renderDataGrid()}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Search Form */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <SearchIcon className="w-4 h-4" />
                  Search Records
                </h2>
                <form onSubmit={handleSearch} className="space-y-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <FormField label="From Date">
                      <DateInput 
                        value={fromDate}
                        onChange={setFromDate}
                      />
                    </FormField>
                    <FormField label="To Date">
                      <DateInput 
                        value={toDate}
                        onChange={setToDate}
                      />
                    </FormField>
                    <FormField label="Category">
                      <select
                        value={searchCategory}
                        onChange={(e) => setSearchCategory(e.target.value)}
                        className={inputClasses + " appearance-none"}
                      >
                        <option value="">All Categories</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-zinc-900 text-white py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <SearchIcon className="w-4 h-4" />
                      Search
                    </button>
                    {searchResults !== null && searchResults.length > 0 && (
                      <button
                        type="button"
                        onClick={exportToCSV}
                        className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        Export CSV
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Search Results */}
              {searchResults !== null && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-bold text-lg">Search Results</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Found: {searchResults.length}
                    </p>
                  </div>
                  {renderDataGrid()}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
