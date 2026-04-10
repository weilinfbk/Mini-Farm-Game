
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { WeatherType, GameState, Player, PlayerCrop } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['polling', 'websocket']
});

const PORT = 3000;

// Game Constants
const CROPS = [
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

// Global State
let gameState: GameState = {
  weather: '晴朗',
  marketPrices: {},
  leaderboard: []
};

const players: Record<string, Player> = {};
const socketToPlayerId: Record<string, string> = {};
const marketSupply: Record<string, number> = {};

const DATA_FILE = path.join(__dirname, 'players_data.json');

// Load players from disk
const loadPlayers = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const savedPlayers = JSON.parse(data);
      Object.assign(players, savedPlayers);
      console.log(`Loaded ${Object.keys(players).length} players from disk.`);
    }
  } catch (err) {
    console.error('Error loading players:', err);
  }
};

// Save players to disk
const savePlayers = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(players, null, 2));
  } catch (err) {
    console.error('Error saving players:', err);
  }
};

loadPlayers();

// Initialize market prices and supply
const initializeMarket = () => {
  CROPS.forEach(crop => {
    gameState.marketPrices[crop.id] = crop.basePrice;
    marketSupply[crop.id] = 0;
  });
  FISH.forEach(fish => {
    gameState.marketPrices[fish.id] = fish.basePrice;
    marketSupply[fish.id] = 0;
  });
};
initializeMarket();

const updateMarketPrices = () => {
  const weatherModifiers: Record<WeatherType, { crop: number, fish: number }> = {
    '晴朗': { crop: 1.0, fish: 1.0 },
    '雨天': { crop: 0.9, fish: 1.2 },
    '暴风雨': { crop: 0.8, fish: 1.5 },
    '干旱': { crop: 1.4, fish: 0.7 }
  };

  const mods = weatherModifiers[gameState.weather];

  CROPS.forEach(crop => {
    const supplyMod = Math.max(0.5, 1 - (marketSupply[crop.id] / 100)); // Max 50% drop from supply
    const randomMod = 0.9 + Math.random() * 0.2; // +/- 10% random
    const finalPrice = Math.round(crop.basePrice * mods.crop * supplyMod * randomMod);
    gameState.marketPrices[crop.id] = Math.max(1, finalPrice);
  });

  FISH.forEach(fish => {
    const supplyMod = Math.max(0.5, 1 - (marketSupply[fish.id] / 50)); // Fish supply is more sensitive
    const randomMod = 0.85 + Math.random() * 0.3; // +/- 15% random
    const finalPrice = Math.round(fish.basePrice * mods.fish * supplyMod * randomMod);
    gameState.marketPrices[fish.id] = Math.max(1, finalPrice);
  });

  io.emit('gameStateUpdate', gameState);
};

// Weather System
const WEATHERS: WeatherType[] = ['晴朗', '雨天', '暴风雨', '干旱'];
setInterval(() => {
  gameState.weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
  
  // Demand recovery: supply decreases over time
  Object.keys(marketSupply).forEach(id => {
    marketSupply[id] = Math.max(0, marketSupply[id] - 2); // Recover 2 units per minute
  });

  updateMarketPrices();
}, 60000);

// Socket Logic
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  socket.on('join', ({ name, playerId }: { name: string, playerId: string }) => {
    try {
      if (!playerId) {
        console.error('Join failed: No playerId provided');
        return;
      }

      console.log(`Player ${name} (${playerId}) joining...`);
      socketToPlayerId[socket.id] = playerId;

      if (!players[playerId]) {
        players[playerId] = {
          id: playerId,
          name: name || `农夫 ${playerId.slice(0, 4)}`,
          gold: 10,
          harvestCount: 0,
          level: 1,
          exp: 0,
          inventory: {},
          plots: Array(4).fill(null),
          tools: {
            wateringCan: 1,
            hoe: 1,
            scythe: 1,
            farm: 1,
            fishingRod: 1
          }
        };
        savePlayers();
      } else {
        // Update name if it changed
        if (name && name !== '农夫') {
          players[playerId].name = name;
        }
      }

      // Send both updates to ensure client is synced
      socket.emit('gameStateUpdate', gameState);
      socket.emit('playerUpdate', players[playerId]);
      updateLeaderboard();
      
      console.log(`Player ${playerId} joined successfully`);
    } catch (err) {
      console.error('Error in join handler:', err);
    }
  });

  socket.on('plant', ({ plotIndex, cropId }) => {
    const playerId = socketToPlayerId[socket.id];
    const player = players[playerId];
    if (!player) return;

    const crop = CROPS.find(c => c.id === cropId);
    if (!crop || player.gold < crop.seedPrice || player.plots[plotIndex]) return;

    player.gold -= crop.seedPrice;
    player.plots[plotIndex] = {
      id: Math.random().toString(36).substr(2, 9),
      cropId,
      plantedAt: Date.now(),
      wateredAt: Date.now(),
      stage: 0,
      isDead: false
    };

    savePlayers();
    socket.emit('playerUpdate', player);
  });

  socket.on('harvest', (plotIndex) => {
    const playerId = socketToPlayerId[socket.id];
    const player = players[playerId];
    if (!player) return;

    const plot = player.plots[plotIndex];
    if (!plot || plot.stage < 3 || plot.isDead) return;

    const crop = CROPS.find(c => c.id === plot.cropId);
    if (!crop) return;

    player.inventory[crop.id] = (player.inventory[crop.id] || 0) + 1;
    player.harvestCount++;
    player.exp += 10;
    
    // Level up logic
    if (player.exp >= player.level * 50) {
      player.level++;
      player.exp = 0;
    }

    player.plots[plotIndex] = null;
    savePlayers();
    socket.emit('playerUpdate', player);
    updateLeaderboard();
  });

  socket.on('sell', (itemId) => {
    const playerId = socketToPlayerId[socket.id];
    const player = players[playerId];
    if (!player || !player.inventory[itemId]) return;

    const price = gameState.marketPrices[itemId] || 0;
    player.inventory[itemId]--;
    player.gold += price;

    // Increase supply, which will lower price in the next update
    marketSupply[itemId] = (marketSupply[itemId] || 0) + 1;
    
    // If supply reaches a threshold, trigger a price update immediately for "large scale trade" feel
    if (marketSupply[itemId] % 10 === 0) {
      updateMarketPrices();
    }

    savePlayers();
    socket.emit('playerUpdate', player);
  });

  socket.on('fishing', () => {
    const playerId = socketToPlayerId[socket.id];
    const player = players[playerId];
    if (!player) return;

    // Simple fishing logic: wait time based on rod level
    const waitTime = Math.max(2000, 8000 - (player.tools.fishingRod * 1000));
    
    setTimeout(() => {
      const currentPlayer = players[playerId];
      if (!currentPlayer) return; 

      // Rarity chances based on rod level
      const rod = currentPlayer.tools.fishingRod;
      const roll = Math.random() * 100;
      
      let fishId = 'carp';
      if (rod >= 4 && roll < 5) fishId = 'shark';
      else if (rod >= 3 && roll < 15) fishId = 'tuna';
      else if (rod >= 2 && roll < 40) fishId = 'salmon';
      else fishId = 'carp';

      const fish = FISH.find(f => f.id === fishId);
      if (fish) {
        currentPlayer.inventory[fishId] = (currentPlayer.inventory[fishId] || 0) + 1;
        currentPlayer.exp += 15;
        if (currentPlayer.exp >= currentPlayer.level * 50) {
          currentPlayer.level++;
          currentPlayer.exp = 0;
        }
        savePlayers();
        io.to(socket.id).emit('playerUpdate', currentPlayer);
        io.to(socket.id).emit('fishingResult', fish);
      }
    }, waitTime);
  });

  socket.on('upgradeTool', (toolName: keyof Player['tools']) => {
    const playerId = socketToPlayerId[socket.id];
    const player = players[playerId];
    if (!player) return;

    const currentLevel = player.tools[toolName];
    let cost = 0;

    if (toolName === 'farm') {
      const farmCosts = [0, 250, 800, 1500, 5000];
      if (currentLevel >= farmCosts.length) return;
      cost = farmCosts[currentLevel];
    } else {
      cost = currentLevel * 100;
    }

    if (player.gold >= cost && cost > 0) {
      player.gold -= cost;
      player.tools[toolName]++;
      
      if (toolName === 'farm') {
        const farmSizes = [0, 4, 6, 9, 12, 16];
        const newSize = farmSizes[player.tools.farm];
        const currentPlots = player.plots.length;
        if (newSize > currentPlots) {
          const additional = Array(newSize - currentPlots).fill(null);
          player.plots = [...player.plots, ...additional];
        }
      }
      
      savePlayers();
      socket.emit('playerUpdate', player);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete socketToPlayerId[socket.id];
    updateLeaderboard();
  });
});

function updateLeaderboard() {
  const sorted = Object.values(players)
    .sort((a, b) => b.harvestCount - a.harvestCount)
    .slice(0, 10)
    .map(p => ({ name: p.name, harvests: p.harvestCount }));
  
  gameState.leaderboard = sorted;
  io.emit('gameStateUpdate', gameState);
}

// Plot growth logic
setInterval(() => {
  let anyChanged = false;
  Object.values(players).forEach(player => {
    let changed = false;
    player.plots.forEach((plot, index) => {
      if (plot && !plot.isDead && plot.stage < 3) {
        const crop = CROPS.find(c => c.id === plot.cropId);
        if (crop) {
          const elapsed = (Date.now() - plot.plantedAt) / 1000;
          const growthRate = gameState.weather === '雨天' ? 1.5 : (gameState.weather === '干旱' ? 0.5 : 1);
          const progress = (elapsed * growthRate) / crop.growthTime;
          
          const newStage = Math.min(3, Math.floor(progress * 4));
          if (newStage > plot.stage) {
            plot.stage = newStage;
            changed = true;
            anyChanged = true;
          }

          // Stormy weather risk
          if (gameState.weather === '暴风雨' && Math.random() < 0.001) {
            plot.isDead = true;
            changed = true;
            anyChanged = true;
          }
        }
      }
    });
    if (changed) {
      // Find socket for this player
      const socketId = Object.keys(socketToPlayerId).find(key => socketToPlayerId[key] === player.id);
      if (socketId) {
        io.to(socketId).emit('playerUpdate', player);
      }
    }
  });
  if (anyChanged) {
    savePlayers();
  }
}, 1000);

async function startServer() {
  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      time: new Date().toISOString(),
      playersCount: Object.keys(players).length,
      weather: gameState.weather,
      socketClients: io.engine.clientsCount,
      env: process.env.NODE_ENV || 'development'
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
