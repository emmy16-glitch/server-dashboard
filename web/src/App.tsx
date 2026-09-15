import React, { useState } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { getThemeClasses } from './utils/themeStyles';
import { DesignBar } from './components/design/DesignBar';
import { Header } from './components/header/Header';
import { ProjectsGrid } from './components/projects/ProjectsGrid';
import { IncidentsCenter } from './components/incidents/IncidentsCenter';
import { DeployPipelineModal } from './components/deploys/DeployPipelineModal';
import { SafeTerminal } from './components/terminal/SafeTerminal';
import { AiAssistantModal } from './components/ai/AiAssistantModal';
import { TemplatesDirectory } from './components/templates/TemplatesDirectory';
import { AgentsMatrix } from './components/agents/AgentsMatrix';
import { AuditLogModal } from './components/audit/AuditLogModal';
import { ProjectDetailModal } from './components/drawer/ProjectDetailModal';
import { AddProjectModal } from './components/modals/AddProjectModal';
import { McpInspectorModal } from './components/mcp/McpInspectorModal';
import { LoginScreen } from './components/LoginScreen';
import { Project } from './types/dashboard';
import {
  Server,
  Layers,
} from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { design, authed } = useDashboard();
  const theme = getThemeClasses(design);

  if (!authed) return <LoginScreen />;

  const [currentTab, setCurrentTab] = useState<string>('projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<string>('logs');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showMcpModal, setShowMcpModal] = useState<boolean>(false);

  const handleOpenDetails = (proj: Project, tab = 'logs') => {
    setSelectedProject(proj);
    setModalInitialTab(tab);
  };

  const handleOpenAi = (proj: Project) => {
    setSelectedProject(proj);
    setModalInitialTab('ai');
  };

  const handleOpenTerminal = (proj: Project) => {
    setSelectedProject(proj);
    setModalInitialTab('terminal');
  };

  const handleOpenDeploy = (proj: Project) => {
    setSelectedProject(proj);
    setModalInitialTab('deploys');
  };

  return (
    <div className={`${theme.wrapper} ${theme.fontFamily} relative flex flex-col justify-between min-h-screen`}>
      {/* Optional CRT Scanlines Overlay */}
      {design.scanlines && (
        <div
          className="pointer-events-none fixed inset-0 z-50 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.45) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04))',
            backgroundSize: '100% 3px, 6px 100%',
          }}
        />
      )}

      <div>
        {/* Sticky System Variant Bar */}
        <DesignBar />

        {/* Global Server Header & Navigation */}
        <Header
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenAddModal={() => setShowAddModal(true)}
        />

        {/* Main Workspace Area */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {currentTab === 'projects' && (
            <ProjectsGrid
              onOpenDetails={handleOpenDetails}
              onOpenAi={handleOpenAi}
              onOpenTerminal={handleOpenTerminal}
              onOpenDeploy={handleOpenDeploy}
            />
          )}

          {currentTab === 'incidents' && <IncidentsCenter />}

          {currentTab === 'deploys' && <DeployPipelineModal />}

          {currentTab === 'terminal' && <SafeTerminal />}

          {currentTab === 'ai-ops' && <AiAssistantModal />}

          {currentTab === 'templates' && <TemplatesDirectory />}

          {currentTab === 'agents' && <AgentsMatrix />}

          {currentTab === 'audit' && <AuditLogModal />}
        </main>
      </div>

      {/* Footer & Design Specs Bar */}
      <footer className="border-t border-current/10 py-6 px-4 mt-12 bg-current/5 text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>server-dashboard</span>
            </span>
            <span className="opacity-40">·</span>
            <span className="opacity-70">
              Host: <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">android/proot (Termux)</code>
            </span>
            <span className="opacity-40">·</span>
            <span className="opacity-70">No Docker/PM2</span>
            <span className="opacity-40">·</span>
            <button
              onClick={() => setShowMcpModal(true)}
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              <Layers className="w-3 h-3" />
              <span>MCP Tools Manifest</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-[11px] opacity-75">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>
                Theme: <strong className="capitalize">{design.material}</strong> /{' '}
                <strong className="capitalize">{design.composition}</strong> /{' '}
                <strong className="capitalize">{design.structure}</strong> /{' '}
                <strong className="capitalize">{design.feeling}</strong>
              </span>
            </div>

            <a
              href="https://github.com/emmy16-glitch/server-dashboard"
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-400 flex items-center gap-1 opacity-80 hover:opacity-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>emmy16-glitch/server-dashboard</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Project Deep-Dive Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          initialTab={modalInitialTab}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {/* Add New Project Modal */}
      {showAddModal && <AddProjectModal onClose={() => setShowAddModal(false)} />}

      {/* MCP Tools Modal */}
      {showMcpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className={`${theme.modal} w-full max-w-5xl h-[85vh] overflow-y-auto p-6 space-y-4 border shadow-2xl`}>
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <h3 className="font-bold text-base">Model Context Protocol (MCP) Tools</h3>
              <button onClick={() => setShowMcpModal(false)} className="opacity-60 hover:opacity-100 text-sm">
                ✕
              </button>
            </div>
            <McpInspectorModal />
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
