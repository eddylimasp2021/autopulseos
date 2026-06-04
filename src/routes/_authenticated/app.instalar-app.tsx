import { createFileRoute } from '@tanstack/react-router';
import { Monitor, Smartphone, Apple, Zap, Settings2, Download, Share, PlusSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export const Route = createFileRoute('/_authenticated/app/instalar-app')({
  component: InstallAppPage,
});

function InstallAppPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Instalar Aplicativo
          </h1>
          <p className="text-muted-foreground mt-1">
            Instale o sistema no seu Desktop ou Celular para acesso rápido e experiência de aplicativo nativo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Desktop */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-6 rounded-3xl relative overflow-hidden group flex flex-col h-full"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/20 text-blue-500">
              <Monitor className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Desktop (PC)</h3>
              <p className="text-xs text-muted-foreground">Windows, Mac ou Linux</p>
            </div>
          </div>
          
          <div className="space-y-4 flex-1">
            <p className="text-sm text-foreground/80 mb-4">
              Instale via Google Chrome ou Edge para usar como um programa independente, sem precisar abrir o navegador toda vez.
            </p>
            
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-500 text-xs font-bold">1</span>
                <span>Abra o sistema no <strong>Google Chrome</strong> ou <strong>Edge</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-500 text-xs font-bold">2</span>
                <span>Procure o ícone de instalação (<Download className="h-3 w-3 inline mx-1"/>) na barra de endereços (canto superior direito).</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-500 text-xs font-bold">3</span>
                <span>Clique em <strong>"Instalar Autopulse OS"</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-500 text-xs font-bold">4</span>
                <span>Um atalho será criado na sua área de trabalho!</span>
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Card 2: Android */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass p-6 rounded-3xl relative overflow-hidden group flex flex-col h-full"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-green-500/20 text-green-500">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Android</h3>
              <p className="text-xs text-muted-foreground">Celulares e Tablets</p>
            </div>
          </div>
          
          <div className="space-y-4 flex-1">
            <p className="text-sm text-foreground/80 mb-4">
              Tenha o Autopulse OS na tela inicial do seu celular, ocupando menos espaço e rodando mais rápido.
            </p>
            
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500 text-xs font-bold">1</span>
                <span>Acesse o sistema pelo <strong>Google Chrome</strong> no seu celular.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500 text-xs font-bold">2</span>
                <span>Toque nos <strong>três pontinhos (⋮)</strong> no canto superior direito do navegador.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500 text-xs font-bold">3</span>
                <span>Selecione <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500 text-xs font-bold">4</span>
                <span>Confirme em <strong>"Adicionar"</strong> e pronto! O app estará no seu celular.</span>
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Card 3: iPhone/iPad */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass p-6 rounded-3xl relative overflow-hidden group flex flex-col h-full"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-800/20 dark:bg-zinc-100/20 text-zinc-800 dark:text-zinc-100">
              <Apple className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">iPhone / iPad</h3>
              <p className="text-xs text-muted-foreground">Dispositivos iOS</p>
            </div>
          </div>
          
          <div className="space-y-4 flex-1">
            <p className="text-sm text-foreground/80 mb-4">
              No iOS, a instalação é feita pelo navegador Safari, transformando o site em um App nativo no seu iPhone.
            </p>
            
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800/20 dark:bg-zinc-100/20 text-zinc-800 dark:text-zinc-100 text-xs font-bold">1</span>
                <span>Abra o sistema pelo navegador <strong>Safari</strong> no seu iPhone ou iPad.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800/20 dark:bg-zinc-100/20 text-zinc-800 dark:text-zinc-100 text-xs font-bold">2</span>
                <span>Toque no botão de <strong>Compartilhar</strong> (<Share className="h-3 w-3 inline mx-1"/>) na barra inferior da tela.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800/20 dark:bg-zinc-100/20 text-zinc-800 dark:text-zinc-100 text-xs font-bold">3</span>
                <span>Role o menu para baixo e escolha <strong>"Adicionar à Tela de Início"</strong> (<PlusSquare className="h-3 w-3 inline mx-1"/>).</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800/20 dark:bg-zinc-100/20 text-zinc-800 dark:text-zinc-100 text-xs font-bold">4</span>
                <span>Toque em <strong>"Adicionar"</strong> no canto superior direito.</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>

      <div className="glass rounded-3xl p-6 mt-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
        <h3 className="text-xl font-bold font-display mb-4">Por que transformar em App?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="font-semibold text-sm">Mais Rápido</h4>
            <p className="text-xs text-muted-foreground">O sistema carrega instantaneamente sem precisar digitar o endereço novamente.</p>
          </div>
          <div className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Settings2 className="h-5 w-5" />
            </div>
            <h4 className="font-semibold text-sm">Experiência Nativa</h4>
            <p className="text-xs text-muted-foreground">Funciona como um app de verdade, ocultando a barra de pesquisa do navegador.</p>
          </div>
          <div className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Monitor className="h-5 w-5" />
            </div>
            <h4 className="font-semibold text-sm">Mais Espaço de Tela</h4>
            <p className="text-xs text-muted-foreground">Aproveita 100% da tela do seu dispositivo para você trabalhar confortavelmente.</p>
          </div>
          <div className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Smartphone className="h-5 w-5" />
            </div>
            <h4 className="font-semibold text-sm">Acesso Direto</h4>
            <p className="text-xs text-muted-foreground">Ícone sempre à mão na tela inicial do celular ou na área de trabalho do PC.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
