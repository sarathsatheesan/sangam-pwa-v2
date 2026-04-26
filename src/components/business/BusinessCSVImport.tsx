// ═════════════════════════════════════════════════════════════════════════════════
// BusinessCSVImport — Bulk business import via CSV upload (#37)
// Parses CSV, validates rows, shows preview table, batch-writes to Firestore
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2,
  Download, Loader2, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { collection, addDoc, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { CATEGORIES, CATEGORY_EMOJI_MAP, CATEGORY_COLORS } from '@/components/business/businessConstants';

// ── Types ────────────────────────────────────────────────────────────────────

interface CSVRow {
  name: string;
  category: string;
  description: string;
  location: string;
  phone: string;
  website: string;
  email: string;
  hours: string;
  priceRange: string;
  yearEstablished: string;
  latitude: string;
  longitude: string;
  bookingUrl: string;
  services: string;
  specialtyTags: string;
  paymentMethods: string;
  deliveryOptions: string;
  heritage: string;
  serviceRadius: string;
}

interface ParsedRow extends CSVRow {
  _rowNum: number;
  _errors: string[];
  _warnings: string[];
  _selected: boolean;
}

interface BusinessCSVImportProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole: string;
  userHeritage?: string | string[];
  onImportComplete: (count: number) => void;
}

// ── CSV Column mapping ───────────────────────────────────────────────────────

const REQUIRED_COLUMNS = ['name', 'category', 'location'];

const COLUMN_MAP: Record<string, keyof CSVRow> = {
  'name': 'name',
  'business name': 'name',
  'business_name': 'name',
  'category': 'category',
  'type': 'category',
  'business type': 'category',
  'business_type': 'category',
  'description': 'description',
  'desc': 'description',
  'about': 'description',
  'location': 'location',
  'address': 'location',
  'city': 'location',
  'phone': 'phone',
  'phone number': 'phone',
  'phone_number': 'phone',
  'tel': 'phone',
  'website': 'website',
  'url': 'website',
  'web': 'website',
  'email': 'email',
  'email address': 'email',
  'email_address': 'email',
  'hours': 'hours',
  'business hours': 'hours',
  'business_hours': 'hours',
  'opening hours': 'hours',
  'price range': 'priceRange',
  'price_range': 'priceRange',
  'pricerange': 'priceRange',
  'price': 'priceRange',
  'year established': 'yearEstablished',
  'year_established': 'yearEstablished',
  'yearestablished': 'yearEstablished',
  'year': 'yearEstablished',
  'founded': 'yearEstablished',
  'latitude': 'latitude',
  'lat': 'latitude',
  'longitude': 'longitude',
  'lng': 'longitude',
  'lon': 'longitude',
  'booking url': 'bookingUrl',
  'booking_url': 'bookingUrl',
  'bookingurl': 'bookingUrl',
  'booking': 'bookingUrl',
  'reservation': 'bookingUrl',
  'services': 'services',
  'specialty tags': 'specialtyTags',
  'specialty_tags': 'specialtyTags',
  'specialtytags': 'specialtyTags',
  'tags': 'specialtyTags',
  'payment methods': 'paymentMethods',
  'payment_methods': 'paymentMethods',
  'paymentmethods': 'paymentMethods',
  'payment': 'paymentMethods',
  'delivery options': 'deliveryOptions',
  'delivery_options': 'deliveryOptions',
  'deliveryoptions': 'deliveryOptions',
  'delivery': 'deliveryOptions',
  'heritage': 'heritage',
  'ethnicity': 'heritage',
  'community': 'heritage',
  'service radius': 'serviceRadius',
  'service_radius': 'serviceRadius',
  'serviceradius': 'serviceRadius',
  'max service radius': 'serviceRadius',
  'max_service_radius': 'serviceRadius',
  'delivery radius': 'serviceRadius',
  'delivery_radius': 'serviceRadius',
};

// ── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map(parseCSVLine);
  return { headers, rows };
}

// ── Validation ───────────────────────────────────────────────────────────────

const categorySet = new Set(CATEGORIES.map((c) => c.toLowerCase()));

function findClosestCategory(input: string): string | null {
  const lower = input.toLowerCase().trim();
  for (const cat of CATEGORIES) {
    if (cat.toLowerCase() === lower) return cat;
  }
  // Partial match
  for (const cat of CATEGORIES) {
    if (cat.toLowerCase().includes(lower) || lower.includes(cat.toLowerCase())) return cat;
  }
  return null;
}

function validateRow(row: CSVRow, rowNum: number): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.name.trim()) errors.push('Name is required');
  if (!row.category.trim()) {
    errors.push('Category is required');
  } else if (!findClosestCategory(row.category)) {
    errors.push(`Unknown category "${row.category}". Valid: ${CATEGORIES.join(', ')}`);
  }
  if (!row.location.trim()) errors.push('Location is required');

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    warnings.push('Email format looks invalid');
  }
  if (row.website && !/^https?:\/\//i.test(row.website) && row.website.includes('.')) {
    warnings.push('Website should start with http:// or https://');
  }
  if (row.latitude && (isNaN(Number(row.latitude)) || Math.abs(Number(row.latitude)) > 90)) {
    warnings.push('Invalid latitude');
  }
  if (row.longitude && (isNaN(Number(row.longitude)) || Math.abs(Number(row.longitude)) > 180)) {
    warnings.push('Invalid longitude');
  }
  if (row.yearEstablished && (isNaN(Number(row.yearEstablished)) || Number(row.yearEstablished) < 1800 || Number(row.yearEstablished) > new Date().getFullYear())) {
    warnings.push('Year established looks invalid');
  }

  return { ...row, _rowNum: rowNum, _errors: errors, _warnings: warnings, _selected: errors.length === 0 };
}

// ── Component ────────────────────────────────────────────────────────────────

const BusinessCSVImport: React.FC<BusinessCSVImportProps> = ({
  isOpen, onClose, userId, userName, userRole, userHeritage, onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setParsedRows([]);
      setUnmappedHeaders([]);
      setImportProgress(0);
      setImportTotal(0);
      setImportedCount(0);
      setImportErrors([]);
      setDragOver(false);
      setShowAllColumns(false);
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'importing') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, step, onClose]);

  // ── File processing ────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
      alert('Please upload a CSV file (.csv, .tsv, or .txt)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);

      // Map headers
      const headerMap: Record<number, keyof CSVRow> = {};
      const unmapped: string[] = [];
      headers.forEach((h, i) => {
        const mapped = COLUMN_MAP[h];
        if (mapped) {
          headerMap[i] = mapped;
        } else if (h) {
          unmapped.push(h);
        }
      });
      setUnmappedHeaders(unmapped);

      // Check required columns present
      const mappedFields = new Set(Object.values(headerMap));
      const missingRequired = REQUIRED_COLUMNS.filter((r) => !mappedFields.has(r as keyof CSVRow));
      if (missingRequired.length > 0) {
        alert(`Missing required columns: ${missingRequired.join(', ')}\n\nYour CSV must have columns for: name, category, location`);
        return;
      }

      // Parse rows
      const parsed: ParsedRow[] = rows.map((cells, rowIdx) => {
        const row: CSVRow = {
          name: '', category: '', description: '', location: '',
          phone: '', website: '', email: '', hours: '', priceRange: '',
          yearEstablished: '', latitude: '', longitude: '', bookingUrl: '',
          services: '', specialtyTags: '', paymentMethods: '', deliveryOptions: '',
          heritage: '', serviceRadius: '',
        };
        cells.forEach((cell, colIdx) => {
          const field = headerMap[colIdx];
          if (field) row[field] = cell;
        });
        return validateRow(row, rowIdx + 2); // +2 for 1-indexed + header row
      });

      setParsedRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Row selection ──────────────────────────────────────────────────────────

  const toggleRow = useCallback((rowNum: number) => {
    setParsedRows((prev) =>
      prev.map((r) => r._rowNum === rowNum ? { ...r, _selected: !r._selected } : r)
    );
  }, []);

  const toggleAll = useCallback((selected: boolean) => {
    setParsedRows((prev) =>
      prev.map((r) => r._errors.length === 0 ? { ...r, _selected: selected } : r)
    );
  }, []);

  const removeRow = useCallback((rowNum: number) => {
    setParsedRows((prev) => prev.filter((r) => r._rowNum !== rowNum));
  }, []);

  // ── Import to Firestore ────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    const selected = parsedRows.filter((r) => r._selected && r._errors.length === 0);
    if (selected.length === 0) return;

    setStep('importing');
    setImportTotal(selected.length);
    setImportProgress(0);
    setImportedCount(0);
    const errors: string[] = [];

    // Firestore batch limit is 500, process in chunks
    const BATCH_SIZE = 20;
    let successCount = 0;

    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const chunk = selected.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const row of chunk) {
        const category = findClosestCategory(row.category) || 'Other';
        const bizData: Record<string, any> = {
          name: row.name.trim(),
          category,
          desc: row.description.trim(),
          location: row.location.trim(),
          phone: row.phone.trim(),
          website: row.website.trim(),
          email: row.email.trim(),
          hours: row.hours.trim(),
          bookingUrl: row.bookingUrl.trim(),
          services: row.services.trim(),
          priceRange: row.priceRange.trim(),
          yearEstablished: row.yearEstablished ? Number(row.yearEstablished) : 0,
          paymentMethods: row.paymentMethods ? row.paymentMethods.split(';').map((s) => s.trim()).filter(Boolean) : [],
          deliveryOptions: row.deliveryOptions ? row.deliveryOptions.split(';').map((s) => s.trim()).filter(Boolean) : [],
          serviceRadius: row.serviceRadius ? Math.min(100, Math.max(1, Number(row.serviceRadius))) : 25,
          specialtyTags: row.specialtyTags ? row.specialtyTags.split(';').map((s) => s.trim()).filter(Boolean) : [],
          emoji: CATEGORY_EMOJI_MAP[category] || '\uD83D\uDCBC',
          bgColor: CATEGORY_COLORS[category] || '#999',
          rating: 0,
          reviews: 0,
          promoted: false,
          createdAt: Timestamp.now(),
          ownerId: userId,
          ownerName: userName,
          heritage: row.heritage
            ? row.heritage.split(';').map((s) => s.trim()).filter(Boolean)
            : Array.isArray(userHeritage)
              ? userHeritage
              : userHeritage
                ? [userHeritage]
                : [],
          viewCount: 0,
          contactClicks: 0,
          shareCount: 0,
          verified: userRole === 'admin',
          followers: [],
          followerCount: 0,
          menu: '',
        };

        // Only add geo if valid
        if (row.latitude && row.longitude && !isNaN(Number(row.latitude)) && !isNaN(Number(row.longitude))) {
          bizData.latitude = Number(row.latitude);
          bizData.longitude = Number(row.longitude);
        }

        // Remove empty string fields to keep Firestore clean
        Object.keys(bizData).forEach((key) => {
          if (bizData[key] === '' || bizData[key] === undefined) delete bizData[key];
        });
        // Ensure required fields always present
        bizData.name = row.name.trim();
        bizData.category = category;
        bizData.desc = bizData.desc || '';
        bizData.location = row.location.trim();
        bizData.rating = bizData.rating ?? 0;
        bizData.reviews = bizData.reviews ?? 0;
        bizData.promoted = false;

        const newDocRef = doc(collection(db, 'businesses'));
        batch.set(newDocRef, bizData);
      }

      try {
        await batch.commit();
        successCount += chunk.length;
      } catch (err: any) {
        console.error('Batch import error:', err);
        errors.push(`Rows ${i + 1}-${i + chunk.length}: ${err.message || 'Unknown error'}`);
      }
      setImportProgress(Math.min(i + chunk.length, selected.length));
    }

    setImportedCount(successCount);
    setImportErrors(errors);
    setStep('done');
  }, [parsedRows, userId, userName, userRole, userHeritage]);

  // ── Download template ──────────────────────────────────────────────────────

  const downloadTemplate = useCallback(() => {
    const headers = 'name,category,description,location,phone,website,email,hours,price range,year established,latitude,longitude,booking url,services,specialty tags,payment methods,delivery options,heritage';
    const example = '"Spice Route Kitchen","Restaurant & Food","Authentic South Indian cuisine","123 Main St, Edison NJ","(732) 555-0123","https://spiceroute.com","info@spiceroute.com","Mon-Sat 11am-10pm; Sun 12pm-9pm","$$","2019","40.5187","-74.4121","https://spiceroute.com/reserve","Dine-in;Takeout;Catering","South Indian;Vegetarian;Vegan","Cash;Credit Card;Apple Pay","Dine-in;Takeout;Delivery","Indian"';
    const csv = headers + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ethniCity_business_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const validRows = parsedRows.filter((r) => r._errors.length === 0);
  const errorRows = parsedRows.filter((r) => r._errors.length > 0);
  const selectedCount = parsedRows.filter((r) => r._selected && r._errors.length === 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget && step !== 'importing') onClose(); }}>
      <div
        ref={modalRef}
        role="dialog"
        aria-label="Bulk import businesses from CSV"
        className="bg-aurora-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-aurora-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aurora-text">Bulk Import Businesses</h2>
              <p className="text-xs text-aurora-text-muted">Upload a CSV file to add multiple businesses at once</p>
            </div>
          </div>
          {step !== 'importing' && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-aurora-surface-variant transition-colors" aria-label="Close">
              <X className="w-5 h-5 text-aurora-text-muted" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Upload Step ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-aurora-border hover:border-aurora-text-muted hover:bg-aurora-surface-variant'
                }`}
              >
                <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-indigo-500' : 'text-aurora-text-muted'}`} />
                <p className="text-sm font-medium text-aurora-text mb-1">
                  {dragOver ? 'Drop your CSV file here' : 'Click to upload or drag & drop'}
                </p>
                <p className="text-xs text-aurora-text-muted">Supports .csv files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Template download */}
              <div className="bg-aurora-surface-variant rounded-xl p-4">
                <h3 className="text-sm font-semibold text-aurora-text mb-2">Need a template?</h3>
                <p className="text-xs text-aurora-text-muted mb-3">
                  Download our CSV template with all supported columns and an example row. Required columns: <span className="font-semibold text-aurora-text">name</span>, <span className="font-semibold text-aurora-text">category</span>, <span className="font-semibold text-aurora-text">location</span>.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-aurora-surface text-sm font-medium text-aurora-text border border-aurora-border hover:bg-aurora-border/30 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>

              {/* Supported categories */}
              <div>
                <button
                  onClick={() => setShowAllColumns(!showAllColumns)}
                  className="flex items-center gap-1 text-xs text-aurora-text-muted hover:text-aurora-text transition-colors"
                >
                  {showAllColumns ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllColumns ? 'Hide' : 'Show'} supported categories
                </button>
                {showAllColumns && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <span key={cat} className="px-2 py-0.5 rounded-full text-[11px] bg-aurora-surface-variant text-aurora-text-secondary border border-aurora-border">
                        {CATEGORY_EMOJI_MAP[cat]} {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Preview Step ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between bg-aurora-surface-variant rounded-xl p-3">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-aurora-text">
                    <FileSpreadsheet className="w-4 h-4" />
                    {parsedRows.length} rows
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {validRows.length} valid
                  </span>
                  {errorRows.length > 0 && (
                    <span className="flex items-center gap-1.5 text-red-500">
                      <AlertCircle className="w-4 h-4" />
                      {errorRows.length} with errors
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAll(selectedCount < validRows.length)}
                    className="text-xs text-aurora-indigo hover:text-aurora-indigo/80 font-medium"
                  >
                    {selectedCount === validRows.length ? 'Deselect all' : 'Select all valid'}
                  </button>
                </div>
              </div>

              {/* Unmapped columns warning */}
              {unmappedHeaders.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <span className="font-medium">Unrecognized columns skipped:</span>{' '}
                    {unmappedHeaders.join(', ')}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="border border-aurora-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-aurora-surface-variant border-b border-aurora-border">
                        <th className="px-3 py-2.5 text-left font-semibold text-aurora-text-secondary w-8"></th>
                        <th className="px-3 py-2.5 text-left font-semibold text-aurora-text-secondary">Row</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-aurora-text-secondary">Name</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-aurora-text-secondary">Category</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-aurora-text-secondary">Location</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-aurora-text-secondary">Phone</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-aurora-text-secondary">Status</th>
                        <th className="px-3 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row) => (
                        <tr
                          key={row._rowNum}
                          className={`border-b border-aurora-border last:border-0 transition-colors ${
                            row._errors.length > 0
                              ? 'bg-red-50/50 dark:bg-red-900/10'
                              : row._selected
                                ? 'bg-emerald-50/30 dark:bg-emerald-900/10'
                                : ''
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={row._selected}
                              disabled={row._errors.length > 0}
                              onChange={() => toggleRow(row._rowNum)}
                              className="rounded border-aurora-border accent-aurora-indigo"
                              aria-label={`Select row ${row._rowNum}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-aurora-text-muted">{row._rowNum}</td>
                          <td className="px-3 py-2 font-medium text-aurora-text max-w-[160px] truncate">{row.name || '—'}</td>
                          <td className="px-3 py-2 text-aurora-text-secondary max-w-[120px] truncate">
                            {findClosestCategory(row.category) ? (
                              <span className="inline-flex items-center gap-1">
                                {CATEGORY_EMOJI_MAP[findClosestCategory(row.category)!]} {findClosestCategory(row.category)}
                              </span>
                            ) : (
                              <span className="text-red-500">{row.category || '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-aurora-text-secondary max-w-[140px] truncate">{row.location || '—'}</td>
                          <td className="px-3 py-2 text-aurora-text-secondary">{row.phone || '—'}</td>
                          <td className="px-3 py-2">
                            {row._errors.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-red-500" title={row._errors.join(', ')}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                {row._errors.length} error{row._errors.length > 1 ? 's' : ''}
                              </span>
                            ) : row._warnings.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-amber-500" title={row._warnings.join(', ')}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                Warning
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-500">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Valid
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => removeRow(row._rowNum)}
                              className="p-1 rounded hover:bg-aurora-surface-variant transition-colors text-aurora-text-muted hover:text-red-500"
                              aria-label={`Remove row ${row._rowNum}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Importing Step ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-aurora-indigo" />
              <p className="text-sm font-medium text-aurora-text">Importing businesses...</p>
              <div className="w-64 h-2 bg-aurora-surface-variant rounded-full overflow-hidden">
                <div
                  className="h-full bg-aurora-indigo rounded-full transition-all duration-300"
                  style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-aurora-text-muted">{importProgress} / {importTotal}</p>
            </div>
          )}

          {/* ── Done Step ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              {importedCount > 0 ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-lg font-semibold text-aurora-text">Import Complete!</p>
                  <p className="text-sm text-aurora-text-muted">
                    Successfully imported <span className="font-semibold text-emerald-600 dark:text-emerald-400">{importedCount}</span> business{importedCount !== 1 ? 'es' : ''}.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-lg font-semibold text-aurora-text">Import Failed</p>
                </>
              )}
              {importErrors.length > 0 && (
                <div className="w-full max-w-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Errors:</p>
                  {importErrors.map((err, i) => (
                    <p key={i} className="text-xs text-red-500">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-aurora-border flex items-center justify-between">
          <div className="text-xs text-aurora-text-muted">
            {step === 'preview' && `${selectedCount} of ${validRows.length} valid rows selected`}
          </div>
          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-aurora-text-muted hover:bg-aurora-surface-variant transition-colors">
                Cancel
              </button>
            )}
            {step === 'preview' && (
              <>
                <button
                  onClick={() => { setStep('upload'); setParsedRows([]); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-aurora-text-muted hover:bg-aurora-surface-variant transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-aurora-indigo text-white hover:bg-aurora-indigo/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Import {selectedCount} Business{selectedCount !== 1 ? 'es' : ''}
                </button>
              </>
            )}
            {step === 'done' && (
              <button
                onClick={() => { onImportComplete(importedCount); onClose(); }}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-aurora-indigo text-white hover:bg-aurora-indigo/90 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BusinessCSVImport);
