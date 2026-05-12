const prisma = require('../lib/prisma');
const config = require('../config/env');
const { pinterestFetch } = require('../lib/pinterestApi');

// GET /api/integrations/pinterest/auth-url
async function getPinterestAuthUrl(req, res) {
  try {
    const scopes = [
      'boards:read',
      'boards:read_secret', 
      'pins:read', 
      'pins:read_secret',
      'user_accounts:read'
    ].join(',');

    const authUrl = `https://www.pinterest.com/oauth/?` + 
      `client_id=${config.pinterest.clientId}&` +
      `redirect_uri=${encodeURIComponent(config.pinterest.redirectUri)}&` +
      `response_type=code&` +
      `scope=${scopes}&` +
      `state=${req.userId}`; // Pass userId as state

    console.log('Generated Auth URL:', authUrl);
    res.json({ authUrl });
  } catch (error) {
    console.error('Get Pinterest auth URL error:', error);
    res.status(500).json({ message: 'Failed to generate auth URL' });
  }
}

async function handlePinterestCallback(req, res) {
  try {
    const { code, state } = req.query;
    console.log('Pinterest callback received:', { code: !!code, state });

    if (!code) {
      console.error('No authorization code received');
      return res.redirect(`${config.frontendUrl}/dashboard/moodboards/new?pinterest=error&message=No+authorization+code`);
    }

    const userId = parseInt(state, 10);
    if (!userId || isNaN(userId)) {
      console.error('Invalid user ID in state:', state);
      return res.redirect(`${config.frontendUrl}/dashboard/moodboards/new?pinterest=error&message=Invalid+user+ID`);
    }

    // Token exchange
    const tokenResponse = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.pinterest.clientId}:${config.pinterest.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.pinterest.redirectUri,
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return res.redirect(`${config.frontendUrl}/dashboard/moodboards/new?pinterest=error&message=Token+exchange+failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // 👇 IMPROVED: Better error handling for user info
    console.log('Token obtained, fetching user info...');
    
    const userResponse = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    console.log('User info response status:', userResponse.status);
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Failed to get user info:', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        body: errorText,
        headers: Object.fromEntries(userResponse.headers.entries())
      });
      
      // Try to get any user info that might be available
      let errorMessage = 'Failed to get user info';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error_description || errorMessage;
      } catch (e) {
        // Use the text as is
      }
      
      return res.redirect(`${config.frontendUrl}/dashboard/moodboards/new?pinterest=error&message=${encodeURIComponent(errorMessage)}`);
    }

    const pinterestUser = await userResponse.json();
    console.log('Successfully got Pinterest user:', pinterestUser.username);


    // Save to database with parsed userId
    const integration = await prisma.pinterestIntegration.upsert({
      where: { userId }, // Use parsed userId
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        pinterestUserId: pinterestUser.id,
        username: pinterestUser.username,
      },
      create: {
        user: { connect: { id: userId } }, // Use parsed userId
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        pinterestUserId: pinterestUser.id,
        username: pinterestUser.username,
      }
    });

    console.log('Pinterest integration saved');


    res.redirect(`${config.frontendUrl}/dashboard/moodboards/new?pinterest=success&message=Pinterest+connected+successfully`);

  } catch (error) {
    console.error('Pinterest callback error:', error);

    res.redirect(`${config.frontendUrl}/dashboard/moodboards/new?pinterest=error&message=${encodeURIComponent(error.message)}`);
  }
}

// GET /api/integrations/pinterest/status
async function getPinterestStatus(req, res) {
  try {
    const integration = await prisma.pinterestIntegration.findUnique({
      where: { userId: req.userId },
      select: {
        username: true,
        createdAt: true
      }
    });

    res.json({ connected: !!integration, integration });

  } catch (error) {
    console.error('Get Pinterest status error:', error);
    res.status(500).json({ message: 'Failed to get Pinterest status' });
  }
}

// GET /api/integrations/pinterest/boards
async function getPinterestBoards(req, res) {
  try {
    const integration = await prisma.pinterestIntegration.findUnique({
      where: { userId: req.userId }
    });

    if (!integration) {
      return res.status(404).json({ message: 'Pinterest account not connected' });
    }

    console.log('Fetching Pinterest boards...');

    const boardsResponse = await pinterestFetch('https://api.pinterest.com/v5/boards', {
      headers: {
        'Authorization': `Bearer ${integration.accessToken}`
      }
    });

    if (!boardsResponse.ok) {
      const errorText = await boardsResponse.text();
      console.error('Failed to fetch boards:', boardsResponse.status, errorText);
      throw new Error(`Failed to fetch boards: ${boardsResponse.status}`);
    }

    const boardsData = await boardsResponse.json();
    const boards = boardsData.items || [];

    console.log(`Found ${boards.length} boards`);

    // Format boards for frontend
    const formattedBoards = boards.map(board => ({
      id: board.id,
      name: board.name,
      description: board.description || '',
      pin_count: board.pin_count || 0,
      privacy: board.privacy || 'public',
      url: board.url || `https://pinterest.com/${integration.username}/${board.name}`
    }));

    res.json({ 
      boards: formattedBoards,
      summary: {
        total_boards: formattedBoards.length,
        total_pins: formattedBoards.reduce((sum, board) => sum + (board.pin_count || 0), 0)
      }
    });

  } catch (error) {
    console.error('Get Pinterest boards error:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch Pinterest boards',
      error: error.message 
    });
  }
}

// GET /api/integrations/pinterest/boards/:boardId/pins
async function getPinsByBoard(req, res) {
  try {
    const integration = await prisma.pinterestIntegration.findUnique({
      where: { userId: req.userId }
    });

    if (!integration) {
      return res.status(404).json({ message: 'Pinterest account not connected' });
    }

    const { boardId } = req.params;
    console.log(`Fetching pins for board: ${boardId}`);

    const pinsResponse = await fetch(`https://api.pinterest.com/v5/boards/${boardId}/pins?page_size=50`, {
      headers: {
        'Authorization': `Bearer ${integration.accessToken}`
      }
    });

    console.log('Pinterest API Response Status:', pinsResponse.status);

    if (!pinsResponse.ok) {
      const errorText = await pinsResponse.text();
      console.error('Failed to fetch board pins:', pinsResponse.status, errorText);
      throw new Error(`Failed to fetch board pins: ${pinsResponse.status}`);
    }

    const pinsData = await pinsResponse.json();
    const pins = pinsData.items || [];

    console.log(`Found ${pins.length} pins in board`);

    // Enhanced image extraction with dimensions
    const formattedPins = [];
    
    for (const pin of pins.slice(0, 20)) {
      try {
        console.log(`Processing pin: ${pin.id}`);
        
        let imageData = extractImageUrlWithFallbacks(pin);
        
        if (!imageData || !imageData.width) {
          console.log(`No dimensions found, fetching detailed pin info for: ${pin.id}`);
          imageData = await fetchPinWithDimensions(pin.id, integration.accessToken);
        }
        
        if (imageData && imageData.url) {
          formattedPins.push({
            id: pin.id,
            title: pin.title || 'Untitled Pin',
            description: pin.description || '',
            image_url: imageData.url,
            image_width: imageData.width || 400,
            image_height: imageData.height || 300,
            board_id: boardId,
            link: pin.link || null,
            created_at: pin.created_at
          });
          console.log(`Added pin with dimensions: ${imageData.width}x${imageData.height}`);
        } else {
          console.log(`No image found for pin: ${pin.id}`);
        }
      } catch (pinError) {
        console.error(`Error processing pin ${pin.id}:`, pinError.message);
      }
    }

    const pinsWithImages = formattedPins.filter(pin => pin.image_url).length;
    console.log(`FINAL RESULTS: ${pinsWithImages}/${formattedPins.length} pins have images`);

    res.json({ 
      pins: formattedPins,
      board_id: boardId,
      summary: {
        total_pins: formattedPins.length,
        pins_with_images: pinsWithImages
      }
    });

  } catch (error) {
    console.error('Get board pins error:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch pins from board',
      error: error.message 
    });
  }
}

// Enhanced image extraction with dimensions
function extractImageUrlWithFallbacks(pin) {
  console.log('Starting image extraction for pin:', pin.id);
  
  if (pin.media?.images) {
    console.log('Checking media.images for high quality with dimensions...');
    
    const imageSizes = pin.media.images;
    const preferredSizes = ['1200x', '600x', '400x300', '150x150'];
    
    for (const size of preferredSizes) {
      if (imageSizes[size]) {
        console.log(`Found ${size}: ${imageSizes[size].width}x${imageSizes[size].height}`);
        return {
          url: imageSizes[size].url,
          width: imageSizes[size].width,
          height: imageSizes[size].height
        };
      }
    }
    
    for (const size in imageSizes) {
      if (imageSizes[size] && imageSizes[size].url) {
        console.log(`Fallback to ${size}: ${imageSizes[size].width}x${imageSizes[size].height}`);
        return {
          url: imageSizes[size].url,
          width: imageSizes[size].width,
          height: imageSizes[size].height
        };
      }
    }
  }
  
  console.log('NO IMAGE FOUND after trying all methods');
  return null;
}

// Function to fetch detailed pin information with dimensions
async function fetchPinWithDimensions(pinId, accessToken) {
  try {
    console.log(`Fetching detailed pin info for: ${pinId}`);
    
    const pinDetailResponse = await fetch(`https://api.pinterest.com/v5/pins/${pinId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (pinDetailResponse.ok) {
      const pinDetail = await pinDetailResponse.json();
      const imageData = extractImageUrlWithFallbacks(pinDetail);
      
      if (imageData) {
        console.log(`Detailed pin fetch successful: ${imageData.width}x${imageData.height}`);
        return imageData;
      }
    } else {
      console.log(`Failed to get pin details: ${pinDetailResponse.status}`);
    }
  } catch (error) {
    console.error(`Error fetching pin details for ${pinId}:`, error.message);
  }
  
  return null;
}

// GET /api/integrations/pinterest/pins (all pins from all boards)
async function getPinterestPins(req, res) {
  try {
    const integration = await prisma.pinterestIntegration.findUnique({
      where: { userId: req.userId }
    });

    if (!integration) {
      return res.status(404).json({ message: 'Pinterest account not connected' });
    }

    console.log('Fetching all pins from all boards...');

    const boardsResponse = await fetch('https://api.pinterest.com/v5/boards', {
      headers: {
        'Authorization': `Bearer ${integration.accessToken}`
      }
    });

    if (!boardsResponse.ok) {
      const errorText = await boardsResponse.text();
      throw new Error(`Failed to fetch boards: ${boardsResponse.status}`);
    }

    const boardsData = await boardsResponse.json();
    const boards = boardsData.items || [];

    let allPins = [];
    
    for (const board of boards.slice(0, 5)) {
      try {
        const pinsResponse = await fetch(`https://api.pinterest.com/v5/boards/${board.id}/pins?page_size=20`, {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`
          }
        });

        if (pinsResponse.ok) {
          const pinsData = await pinsResponse.json();
          const pins = pinsData.items || [];
          
          const formattedPins = pins.map(pin => {
            const imageData = extractImageUrlWithFallbacks(pin);
            
            return {
              id: pin.id,
              title: pin.title || 'Untitled Pin',
              description: pin.description || '',
              image_url: imageData?.url || null,
              board_id: board.id,
              board_name: board.name,
              link: pin.link || null,
              created_at: pin.created_at
            };
          });

          allPins = [...allPins, ...formattedPins];
        }
      } catch (error) {
        console.error(`Error fetching pins from board ${board.id}:`, error.message);
      }
    }

    const pinsWithImages = allPins.filter(pin => pin.image_url).length;
    console.log(`Total: ${pinsWithImages}/${allPins.length} pins with images`);

    res.json({ 
      pins: allPins,
      summary: {
        total_boards: boards.length,
        total_pins: allPins.length,
        pins_with_images: pinsWithImages
      }
    });

  } catch (error) {
    console.error('Get Pinterest pins error:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch Pinterest pins',
      error: error.message 
    });
  }
}

// POST /api/integrations/pinterest/disconnect
async function disconnectPinterest(req, res) {
  try {
    await prisma.pinterestIntegration.delete({
      where: { userId: req.userId }
    });

    res.json({ message: 'Pinterest account disconnected successfully' });

  } catch (error) {
    console.error('Disconnect Pinterest error:', error);
    
    if (error.code === 'P2025') {
      return res.json({ message: 'Pinterest account disconnected successfully' });
    }
    
    res.status(500).json({ message: 'Failed to disconnect Pinterest account' });
  }
}

module.exports = {
  getPinterestAuthUrl,
  handlePinterestCallback,
  getPinterestStatus,
  getPinterestBoards,
  getPinsByBoard,
  getPinterestPins,
  disconnectPinterest
};