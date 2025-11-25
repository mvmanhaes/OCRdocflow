import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { UploadArea } from './components/UploadArea';
import { Editor } from './components/Editor';
import { PricingModal } from './components/PricingModal';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ScanDocument, ScanStatus } from './types';
import { extractTextFromImage } from './services/geminiService';

// Helper to generate UUIDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const App: React.FC = () => {
  const [scans, setScans] = useState<ScanDocument[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Check for API Key on startup
  useEffect(() => {
    const localKey = localStorage.getItem('docuflow_api_key');
    const envKey = process.env.API_KEY;
    if (!localKey && !envKey) {
        setShowWizard(true);
    }
  }, []);

  // Load from LocalStorage on mount to simulate backend persistence
  useEffect(() => {
    const saved = localStorage.getItem('docuflow_scans');
    if (saved) {
      try {
        setScans(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save to LocalStorage whenever scans change
  useEffect(() => {
    localStorage.setItem('docuflow_scans', JSON.stringify(scans));
  }, [scans]);

  const handleFileSelect = async (file: File) => {
    // Double check key exists before starting
    if (!localStorage.getItem('docuflow_api_key') && !process.env.API_KEY) {
        setShowWizard(true);
        return;
    }

    const newId = generateId();
    
    // Create optimistic entry
    const newScan: ScanDocument = {
      id: newId,
      title: "Novo Documento",
      createdAt: Date.now(),
      originalContent: '', 
      mimeType: file.type,
      extractedText: '',
      status: ScanStatus.PROCESSING
    };

    // Prepare Base64
    try {
      const base64 = await fileToBase64(file);
      newScan.originalContent = base64;
      
      setScans(prev => [newScan, ...prev]);
      setActiveScanId(newId);

      // Call Gemini API
      const text = await extractTextFromImage(base64, file.type);
      
      // Update with result
      setScans(prev => prev.map(s => 
        s.id === newId 
          ? { ...s, status: ScanStatus.COMPLETED, extractedText: text }
          : s
      ));
    } catch (error: any) {
      console.error(error);
      if (error.message === "MISSING_KEY") {
          setShowWizard(true);
          // Remove the failed scan
          setScans(prev => prev.filter(s => s.id !== newId));
          setActiveScanId(null);
      } else {
        setScans(prev => prev.map(s => 
            s.id === newId 
            ? { ...s, status: ScanStatus.ERROR, extractedText: "Erro ao processar imagem." }
            : s
        ));
      }
    }
  };

  const handleUpdateTitle = (id: string, newTitle: string) => {
    setScans(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleUpdateText = (id: string, newText: string) => {
    setScans(prev => prev.map(s => s.id === id ? { ...s, extractedText: newText } : s));
  };

  const executeDelete = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este documento?")) {
        setScans(prev => prev.filter(s => s.id !== id));
        if (activeScanId === id) setActiveScanId(null);
    }
  };

  const handleDeleteFromSidebar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    executeDelete(id);
  };

  const handleNewScan = () => {
    setActiveScanId(null);
  };

  // --- Export / Import Logic ---
  const handleExportData = () => {
    const dataStr = JSON.stringify(scans, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `docuflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert("Backup baixado com sucesso!");
  };

  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          // Simple validation
          const isValid = parsed.every(item => 'id' in item && 'extractedText' in item);
          if (isValid) {
            if(window.confirm('Isso substituirá seus documentos atuais. Deseja continuar? (Você pode mesclar os dados se preferir, mas atualmente estamos substituindo).')) {
                 setScans(parsed);
                 alert("Dados restaurados com sucesso!");
                 setShowSettings(false);
            }
          } else {
            alert("Arquivo inválido. Formato incorreto.");
          }
        } else {
            alert("Arquivo inválido. Não é uma lista de documentos.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo. Verifique se é um JSON válido.");
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    setScans([]);
    setActiveScanId(null);
    localStorage.removeItem('docuflow_scans');
    localStorage.removeItem('docuflow_api_key');
    setShowSettings(false);
    window.location.reload(); // Hard reset to trigger wizard again
  };

  const activeScan = scans.find(s => s.id === activeScanId);

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {showWizard && (
          <OnboardingWizard onComplete={() => setShowWizard(false)} />
      )}

      <Sidebar 
        scans={scans}
        activeScanId={activeScanId}
        onSelectScan={setActiveScanId}
        onNewScan={handleNewScan}
        onDeleteScan={handleDeleteFromSidebar}
        onOpenPricing={() => setShowPricing(true)}
        onOpenSettings={() => setShowSettings(true)}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative shadow-2xl z-0">
        {!activeScanId ? (
          <UploadArea onFileSelect={handleFileSelect} />
        ) : (
          activeScan && (
            <Editor 
              scan={activeScan}
              onUpdateTitle={handleUpdateTitle}
              onUpdateText={handleUpdateText}
              onDelete={executeDelete}
            />
          )
        )}
      </main>

      <PricingModal 
        isOpen={showPricing} 
        onClose={() => setShowPricing(false)} 
      />
      
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onExport={handleExportData}
        onImport={handleImportData}
        onClearAll={handleClearAll}
      />
    </div>
  );
};

export default App;