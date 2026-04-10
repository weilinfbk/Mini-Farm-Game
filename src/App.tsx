
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sprout, 
  TrendingUp, 
  Users, 
  Cloud, 
  Sun, 
  CloudRain, 
  CloudLightning, 
  Droplets,
  Coins,
  Package,
  Wrench,
  ChevronRight,
  Trophy,
  ArrowUpCircle,
  Fish,
  Waves,
  HelpCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster, toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Player, GameState, CropType } from './types';

const RainEffect = () => (
  <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
    {[...Array(50)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute bg-blue-400/30 w-[1.5px] h-6 rounded-full"
        initial={{ top: -50, left: `${Math.random() * 100}%` }}
        animate={{ top: '110%' }}
        transition={{
          duration: 0.6 + Math.random() * 0.4,
          repeat: Infinity,
          ease: "linear",
          delay: Math.random() * 2
        }}
      />
    ))}
  </div>
);

const LightningEffect = () => {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const triggerFlash = () => {
      setFlash(true);
      setTimeout(() => setFlash(false), 100 + Math.random() * 150);
      timeout = setTimeout(triggerFlash, 4000 + Math.random() * 8000);
    };
    timeout = setTimeout(triggerFlash, 2000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-white pointer-events-none z-[70]"
        />
      )}
    </AnimatePresence>
  );
};

const DroughtEffect = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 pointer-events-none z-[60] bg-orange-200/10 mix-blend-multiply"
  />
);

const CROPS: CropType[] = [
  { id: 'wheat', name: '小麦', growthTime: 30, basePrice: 10, seedPrice: 5, minLevel: 1, icon: '🌾' },
  { id: 'carrot', name: '胡萝卜', growthTime: 60, basePrice: 25, seedPrice: 12, minLevel: 2, icon: '🥕' },
  { id: 'corn', name: '玉米', growthTime: 120, basePrice: 60, seedPrice: 30, minLevel: 5, icon: '🌽' },
  { id: 'pumpkin', name: '南瓜', growthTime: 300, basePrice: 200, seedPrice: 100, minLevel: 10, icon: '🎃' },
];

const FISH = [
  { id: 'carp', name: '鲤鱼', basePrice: 15, icon: '🐟', rarity: 'common' },
  { id: 'salmon', name: '三文鱼', basePrice: 45, icon: '🍣', rarity: 'uncommon' },
  { id: 'tuna', name: '金枪鱼', basePrice: 120, icon: '🐠', rarity: 'rare' },
  { id: 'shark', name: '鲨鱼', basePrice: 600, icon: '🦈', rarity: 'legendary' },
];

let socket: Socket;

const TUTORIAL_STEPS = [
  {
    title: "欢迎来到简易农场！",
    content: "这是一个轻松愉快的经营游戏。让我们花一分钟了解一下如何开始您的农夫生活。",
    icon: <Sprout className="w-12 h-12 text-green-500" />
  },
  {
    title: "第一步：种植作物",
    content: "在农场区域点击带有虚线框的空地，选择您想种植的种子。初期建议从小麦开始！",
    icon: <Droplets className="w-12 h-12 text-blue-500" />
  },
  {
    title: "第二步：收获成果",
    content: "作物成熟后会显示图标，点击它即可收获。收获会为您提供经验值（EXP）来提升等级。",
    icon: <Package className="w-12 h-12 text-orange-500" />
  },
  {
    title: "第三步：交易与金币",
    content: "在底部的“市场”标签页，您可以将收获的作物卖出换取金币。金币是升级农场的核心资源。",
    icon: <Coins className="w-12 h-12 text-yellow-500" />
  },
  {
    title: "第四步：前往钓鱼",
    content: "点击顶部的“钓鱼”按钮可以切换到鱼塘。钓鱼是获得大量金币的另一种好方法！",
    icon: <Fish className="w-12 h-12 text-cyan-500" />
  },
  {
    title: "第五步：升级与扩张",
    content: "在“升级”标签页，您可以花费金币扩大农场规模或升级鱼竿。越高级的农场产出越高！",
    icon: <Wrench className="w-12 h-12 text-purple-500" />
  },
  {
    title: "最后：关注天气",
    content: "右上角显示当前天气。雨天作物长得快，干旱则会变慢。暴风雨甚至可能损坏作物，请多留意！",
    icon: <CloudRain className="w-12 h-12 text-slate-500" />
  }
];

export default function App() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isFishing, setIsFishing] = useState(false);
  const [currentZone, setCurrentZone] = useState<'farm' | 'fishing'>('farm');
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);

  const joinGame = useCallback(() => {
    if (!socket) return;
    
    console.log('Attempting to join game...');
    try {
      // Get or create a persistent player ID
      let playerId = localStorage.getItem('farm_player_id');
      if (!playerId) {
        playerId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('farm_player_id', playerId);
      }
      // Auto-join with a default name and persistent ID
      socket.emit('join', { name: '农夫', playerId });
    } catch (err) {
      console.error('LocalStorage error:', err);
      const tempId = 'guest_' + Math.random().toString(36).substring(2, 7);
      socket.emit('join', { name: '游客', playerId: tempId });
    }
  }, []);

  useEffect(() => {
    // Initialize socket if not already initialized
    if (!socket) {
      const socketUrl = process.env.APP_URL || window.location.origin;
      console.log('Initializing socket at:', socketUrl);
      
      socket = io(socketUrl, {
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000,
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });
    }

    const onConnect = () => {
      console.log('Connected to server via', socket.io.engine.transport.name);
      setConnectionStatus('connected');
      setLastError(null);
      joinGame();
    };

    const onPlayerUpdate = (updatedPlayer: Player) => {
      console.log('Player updated:', updatedPlayer);
      setPlayer(updatedPlayer);
    };

    const onGameStateUpdate = (updatedGameState: GameState) => {
      console.log('Game state updated:', updatedGameState);
      setGameState(updatedGameState);
    };

    const onFishingResult = (fish: any) => {
      setIsFishing(false);
      toast.success(`你钓到了 ${fish.name}！ ${fish.icon}`);
    };

    const onDisconnect = (reason: string) => {
      console.log('Disconnected from server:', reason);
      setConnectionStatus('connecting');
    };

    const onConnectError = (error: any) => {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      setLastError(error.message || String(error));
      
      // Try to diagnose via health check
      fetch('/api/health')
        .then(res => res.json())
        .then(data => console.log('Server health check:', data))
        .catch(err => console.error('Server health check failed:', err));
      
      toast.error('连接服务器失败，请刷新页面重试');
    };

    // Set up listeners
    socket.on('connect', onConnect);
    socket.on('playerUpdate', onPlayerUpdate);
    socket.on('gameStateUpdate', onGameStateUpdate);
    socket.on('fishingResult', onFishingResult);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // If already connected, trigger onConnect manually
    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    // Check if tutorial should be shown
    try {
      const hasCompletedTutorial = localStorage.getItem('farm_tutorial_completed');
      if (!hasCompletedTutorial) {
        setTutorialStep(0);
      }
    } catch (e) {}

    return () => {
      socket.off('connect', onConnect);
      socket.off('playerUpdate', onPlayerUpdate);
      socket.off('gameStateUpdate', onGameStateUpdate);
      socket.off('fishingResult', onFishingResult);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [joinGame]);

  const plantCrop = (plotIndex: number, cropId: string) => {
    socket.emit('plant', { plotIndex, cropId });
  };

  const harvestCrop = (plotIndex: number) => {
    socket.emit('harvest', plotIndex);
    toast.success('收获成功！');
  };

  const sellCrop = (cropId: string) => {
    socket.emit('sell', cropId);
  };

  const upgradeTool = (toolName: keyof Player['tools']) => {
    socket.emit('upgradeTool', toolName);
  };

  const closeTutorial = () => {
    setTutorialStep(null);
    localStorage.setItem('farm_tutorial_completed', 'true');
  };

  const nextTutorialStep = () => {
    if (tutorialStep === null) return;
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(tutorialStep + 1);
    } else {
      closeTutorial();
    }
  };

  const startFishing = () => {
    if (isFishing) return;
    setIsFishing(true);
    socket.emit('fishing');
  };

  if (!player || !gameState) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
          <motion.div 
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
            className={`w-16 h-16 border-4 ${connectionStatus === 'error' ? 'border-red-500' : 'border-green-500'} border-t-transparent rounded-full`} 
          />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-800">
              {connectionStatus === 'connecting' ? '正在连接农场...' : 
               connectionStatus === 'connected' ? '正在同步数据...' : 
               '连接遇到问题'}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {connectionStatus === 'connecting' ? '我们正在为您准备土地和种子。' : 
               connectionStatus === 'connected' ? '正在从服务器获取您的农场信息。' : 
               `错误详情: ${lastError || '未知网络错误'}`}
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="border-green-200 hover:bg-green-50 text-green-700"
            >
              重新加载页面
            </Button>
            
            {connectionStatus === 'connected' && (
              <Button 
                variant="ghost" 
                onClick={joinGame}
                className="text-gray-400 text-xs"
              >
                手动尝试同步
              </Button>
            )}
          </div>
          
          <div className="pt-8 border-t border-gray-200 w-full">
            <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-widest mb-2">
              <span>状态: {connectionStatus}</span>
              <span>数据: {player ? '已就绪' : '等待中'} / {gameState ? '已就绪' : '等待中'}</span>
            </div>
            <p className="text-xs text-gray-400">
              提示：多人游戏需要稳定的网络连接以同步实时数据。
            </p>
          </div>
        </div>
      </div>
    );
  }

  const WeatherIcon = {
    '晴朗': Sun,
    '雨天': CloudRain,
    '暴风雨': CloudLightning,
    '干旱': Droplets
  }[gameState.weather as string] || Sun;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#f5f5f0] text-gray-800 font-sans pb-20 relative overflow-x-hidden">
        <Toaster position="top-center" />
        
        {/* Weather Effects Overlay */}
        {(gameState.weather === '雨天' || gameState.weather === '暴风雨') && <RainEffect />}
        {gameState.weather === '暴风雨' && <LightningEffect />}
        {gameState.weather === '干旱' && <DroughtEffect />}
        
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            {/* Left: Brand & Level */}
            <div className="flex items-center gap-3 min-w-fit group cursor-default">
              <div className="w-11 h-11 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200/50 group-hover:scale-105 transition-transform">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="font-serif text-xl font-black text-gray-900 tracking-tight leading-none">
                  简易农场
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100">
                    <span className="text-[9px] font-black text-green-600 mr-1">LV.</span>
                    <span className="text-[11px] font-black text-green-700 leading-none">{player.level}</span>
                  </div>
                  <div className="h-1 w-1 rounded-full bg-gray-300" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">专业农夫</span>
                </div>
              </div>
            </div>

            {/* Center: Zone Switcher */}
            <div className="hidden sm:flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200/50">
              <Button 
                variant={currentZone === 'farm' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentZone('farm')}
                className={`rounded-lg h-8 px-4 text-xs font-bold transition-all ${
                  currentZone === 'farm' 
                    ? 'bg-white text-green-700 shadow-sm hover:bg-white' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                <Sprout className="w-3.5 h-3.5 mr-1.5" />
                农场
              </Button>
              <Button 
                variant={currentZone === 'fishing' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentZone('fishing')}
                className={`rounded-lg h-8 px-4 text-xs font-bold transition-all ${
                  currentZone === 'fishing' 
                    ? 'bg-white text-cyan-700 shadow-sm hover:bg-white' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                <Fish className="w-3.5 h-3.5 mr-1.5" />
                钓鱼
              </Button>
            </div>

            {/* Right: Stats */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setTutorialStep(0)}
                className="w-8 h-8 text-gray-400 hover:text-green-600 rounded-full"
              >
                <HelpCircle className="w-5 h-5" />
              </Button>

              <div className="bg-yellow-400/10 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-yellow-400/20">
                <Coins className="w-4 h-4 text-yellow-600" />
                <span className="font-black text-sm text-yellow-700">{player.gold}</span>
              </div>
              
              <div className="bg-blue-400/10 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-blue-400/20">
                <WeatherIcon className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-xs text-blue-700 hidden xs:inline">{gameState.weather}</span>
              </div>
            </div>
          </div>
          
          {/* Mobile Zone Switcher */}
          <div className="sm:hidden flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200/50 mt-2">
            <Button 
              variant={currentZone === 'farm' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentZone('farm')}
              className={`flex-1 rounded-lg h-8 text-xs font-bold transition-all ${
                currentZone === 'farm' 
                  ? 'bg-white text-green-700 shadow-sm' 
                  : 'text-gray-500'
              }`}
            >
              农场
            </Button>
            <Button 
              variant={currentZone === 'fishing' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentZone('fishing')}
              className={`flex-1 rounded-lg h-8 text-xs font-bold transition-all ${
                currentZone === 'fishing' 
                  ? 'bg-white text-cyan-700 shadow-sm' 
                  : 'text-gray-500'
              }`}
            >
              钓鱼
            </Button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          
          {/* Left Column: Stats */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  个人成就
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">经验等级进度</span>
                    <span className="text-xs font-black text-green-600">{player.exp} <span className="text-gray-300 font-medium">/</span> {player.level * 50}</span>
                  </div>
                  <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                    <motion.div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(player.exp / (player.level * 50)) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">总收获次数</span>
                    </div>
                    <span className="text-lg font-black text-gray-800">{player.harvestCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">当前农场等级</span>
                    </div>
                    <span className="text-lg font-black text-gray-800">{player.level}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column: Main Content Area */}
          <div className="md:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {currentZone === 'farm' ? (
                <motion.div 
                  key="farm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`grid gap-2 ${
                    player.tools.farm === 1 ? 'grid-cols-2' : 
                    player.tools.farm === 2 ? 'grid-cols-3' : 
                    player.tools.farm === 3 ? 'grid-cols-3' : 
                    player.tools.farm === 4 ? 'grid-cols-4' : 'grid-cols-4'
                  }`}
                >
                  {player.plots.map((plot, i) => (
                    <Card key={i} className="aspect-square border border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center relative overflow-hidden group hover:border-green-300 transition-colors p-1">
                      {plot ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className={`text-2xl transition-all duration-500 ${plot.stage === 0 ? 'scale-50 opacity-50' : plot.stage === 1 ? 'scale-75' : 'scale-100'}`}>
                            {plot.isDead ? '🥀' : plot.stage === 3 ? CROPS.find(c => c.id === plot.cropId)?.icon : '🌱'}
                          </div>
                          <div className="text-center">
                            {plot.stage < 3 && !plot.isDead && (
                              <div className="w-8 h-1 bg-gray-200 rounded-full mt-0.5 overflow-hidden mx-auto">
                                <motion.div 
                                  className="h-full bg-green-500"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(plot.stage / 3) * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                          {plot.stage === 3 && !plot.isDead && (
                            <Button 
                              size="xs" 
                              onClick={() => harvestCrop(i)}
                              className="h-6 px-2 text-[10px] bg-green-500 hover:bg-green-600 text-white rounded-full shadow-sm"
                            >
                              收获
                            </Button>
                          )}
                          {plot.isDead && (
                            <Button 
                              size="xs" 
                              variant="destructive"
                              onClick={() => harvestCrop(i)} // Reusing harvest to clear plot
                              className="h-6 px-2 text-[10px] rounded-full"
                            >
                              清理
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Dialog>
                          <DialogTrigger render={<Button variant="ghost" className="w-full h-full flex flex-col gap-1 p-0 hover:bg-green-50/50" />}>
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                              <Sprout className="w-3 h-3 text-gray-400 group-hover:text-green-600" />
                            </div>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md border-none shadow-2xl">
                            <DialogHeader>
                              <DialogTitle className="font-serif text-2xl">选择种子</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 py-4">
                              {CROPS.map(crop => (
                                <Button
                                  key={crop.id}
                                  variant="outline"
                                  disabled={player.gold < crop.seedPrice || player.level < crop.minLevel}
                                  onClick={() => plantCrop(i, crop.id)}
                                  className="h-auto flex flex-col items-center p-4 gap-2 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all"
                                >
                                  <span className="text-3xl">{crop.icon}</span>
                                  <div className="text-center">
                                    <p className="font-bold text-sm">{crop.name}</p>
                                    <p className="text-xs text-gray-500">{crop.seedPrice} 金币</p>
                                  </div>
                                  {player.level < crop.minLevel && (
                                    <Badge variant="secondary" className="text-[10px]">等级 {crop.minLevel}</Badge>
                                  )}
                                </Button>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </Card>
                  ))}
                </motion.div>
              ) : (
                <motion.div 
                  key="fishing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card className="border-none shadow-sm bg-white overflow-hidden">
                    <div className="h-64 bg-cyan-100 relative flex items-center justify-center overflow-hidden">
                      <Waves className="absolute bottom-0 w-full h-32 text-cyan-200 animate-pulse" />
                      <Waves className="absolute bottom-6 w-full h-32 text-cyan-300/50 animate-pulse delay-75" />
                      
                      <AnimatePresence>
                        {isFishing ? (
                          <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            className="flex flex-col items-center gap-4 z-10"
                          >
                            <div className="relative">
                              <div className="w-24 h-24 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
                              <Fish className="absolute inset-0 m-auto w-12 h-12 text-cyan-600 animate-bounce" />
                            </div>
                            <p className="text-cyan-800 text-xl font-bold animate-pulse">正在垂钓中...</p>
                          </motion.div>
                        ) : (
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex flex-col items-center gap-4 z-10"
                          >
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
                              <Fish className="w-12 h-12 text-cyan-500" />
                            </div>
                            <Button 
                              onClick={startFishing}
                              className="bg-cyan-600 hover:bg-cyan-700 text-white px-12 py-8 rounded-2xl text-xl font-bold shadow-xl shadow-cyan-200"
                            >
                              开始钓鱼
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4 bg-cyan-50 p-4 rounded-2xl border border-cyan-100">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                          <Fish className="w-6 h-6 text-cyan-600" />
                        </div>
                        <div className="text-sm text-cyan-800 leading-relaxed">
                          <p className="font-bold text-base mb-2">钓鱼指南</p>
                          <ul className="space-y-1 list-disc list-inside opacity-80">
                            <li>升级鱼竿可以缩短等待时间并提高稀有鱼类的上钩率。</li>
                            <li>鲨鱼只能通过 4 级以上的鱼竿钓到。</li>
                            <li>每次钓鱼都会获得经验值！</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Tabs: Inventory, Market, Shop */}
            <Tabs defaultValue="inventory" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                <TabsTrigger value="inventory" className="rounded-xl data-[state=active]:bg-green-50 data-[state=active]:text-green-700">
                  <Package className="w-4 h-4 mr-2" />
                  仓库
                </TabsTrigger>
                <TabsTrigger value="market" className="rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  市场
                </TabsTrigger>
                <TabsTrigger value="shop" className="rounded-xl data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                  <Wrench className="w-4 h-4 mr-2" />
                  升级
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="inventory" className="mt-4">
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {CROPS.map(crop => (
                        <div key={crop.id} className="p-4 bg-gray-50 rounded-2xl flex flex-col items-center gap-2 border border-gray-100">
                          <span className="text-3xl">{crop.icon}</span>
                          <div className="text-center">
                            <p className="text-xs font-bold">{crop.name}</p>
                            <p className="text-lg font-black text-green-600">{player.inventory[crop.id] || 0}</p>
                          </div>
                        </div>
                      ))}
                      {FISH.map(fish => (
                        <div key={fish.id} className="p-4 bg-gray-50 rounded-2xl flex flex-col items-center gap-2 border border-gray-100">
                          <span className="text-3xl">{fish.icon}</span>
                          <div className="text-center">
                            <p className="text-xs font-bold">{fish.name}</p>
                            <p className="text-lg font-black text-cyan-600">{player.inventory[fish.id] || 0}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="market" className="mt-4">
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">农作物</p>
                      {CROPS.map(crop => (
                        <div key={crop.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{crop.icon}</span>
                            <div>
                              <p className="font-bold text-sm">{crop.name}</p>
                              <p className="text-xs text-gray-500">当前价格: <span className="font-bold text-yellow-600">{gameState.marketPrices[crop.id]} 金币</span></p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            disabled={!player.inventory[crop.id]}
                            onClick={() => sellCrop(crop.id)}
                            className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
                          >
                            卖出一个
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">水产</p>
                      {FISH.map(fish => (
                        <div key={fish.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{fish.icon}</span>
                            <div>
                              <p className="font-bold text-sm">{fish.name}</p>
                              <p className="text-xs text-gray-500">当前价格: <span className="font-bold text-yellow-600">{gameState.marketPrices[fish.id]} 金币</span></p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            disabled={!player.inventory[fish.id]}
                            onClick={() => sellCrop(fish.id)}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl"
                          >
                            卖出一个
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shop" className="mt-4">
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="p-4 space-y-4">
                    {(Object.keys(player.tools) as Array<keyof Player['tools']>).map(tool => {
                      const farmCosts = [0, 250, 800, 1500, 5000];
                      const isFarm = tool === 'farm';
                      const isFishingRod = tool === 'fishingRod';
                      const currentLevel = player.tools[tool];
                      
                      let cost = 0;
                      if (isFarm) cost = farmCosts[currentLevel];
                      else if (isFishingRod) cost = currentLevel * 200;
                      else cost = currentLevel * 100;

                      const maxFarmLevel = farmCosts.length - 1;

                      if (isFarm && currentLevel > maxFarmLevel) return null;
                      if (isFarm && cost === 0) return null;

                      const toolNames = {
                        wateringCan: '洒水壶',
                        hoe: '锄头',
                        scythe: '镰刀',
                        farm: '扩建农场',
                        fishingRod: '钓鱼竿'
                      };

                      const farmDescriptions = [
                        '',
                        '扩建至 6x2 (3x2)',
                        '扩建至 3x3',
                        '扩建至 4x3',
                        '扩建至 4x4'
                      ];

                      return (
                        <div key={tool} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                              {isFarm ? <TrendingUp className="w-5 h-5 text-orange-600" /> : 
                               isFishingRod ? <Fish className="w-5 h-5 text-orange-600" /> :
                               <Wrench className="w-5 h-5 text-orange-600" />}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{toolNames[tool]}</p>
                              <p className="text-xs text-gray-500">
                                {isFarm ? farmDescriptions[currentLevel] : `${currentLevel} 级`}
                              </p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            disabled={player.gold < cost || (isFarm && currentLevel > maxFarmLevel)}
                            onClick={() => upgradeTool(tool)}
                            className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center gap-2"
                          >
                            升级 ({cost} G)
                            <ArrowUpCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        {/* Tutorial Overlay */}
        <AnimatePresence>
          {tutorialStep !== null && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden relative"
              >
                <div className="p-8 flex flex-col items-center text-center space-y-6">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    {TUTORIAL_STEPS[tutorialStep].icon}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-gray-900 leading-tight">
                      {TUTORIAL_STEPS[tutorialStep].title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {TUTORIAL_STEPS[tutorialStep].content}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full pt-2">
                    <div className="flex gap-1 flex-1">
                      {TUTORIAL_STEPS.map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-1.5 rounded-full transition-all ${i === tutorialStep ? 'w-6 bg-green-500' : 'w-2 bg-gray-200'}`} 
                        />
                      ))}
                    </div>
                    <Button 
                      onClick={nextTutorialStep}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl px-6"
                    >
                      {tutorialStep === TUTORIAL_STEPS.length - 1 ? '开始游戏' : '下一步'}
                    </Button>
                  </div>
                </div>
                <button 
                  onClick={closeTutorial}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

