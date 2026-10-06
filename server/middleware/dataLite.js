// Data-Lite middleware for low bandwidth optimization
const dataLiteMiddleware = (req, res, next) => {
  // Check if client requested Data-Lite mode
  const dataLiteHeader = req.headers['x-data-lite'];
  
  if (dataLiteHeader === 'true' || req.query.dataLite === 'true') {
    req.dataLiteMode = true;
    
    // Add compression headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  } else {
    req.dataLiteMode = false;
  }
  
  next();
};

module.exports = dataLiteMiddleware;
