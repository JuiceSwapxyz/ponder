export const customSwaggerUIHtml = (specUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="JuiceSwap Ponder API Documentation" />
    <title>JuiceSwap API - Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <link rel="icon" type="image/png" href="https://juiceswap.com/favicon.png" />
    <style>
      /* Custom theme inspired by DFX */
      body {
        margin: 0;
        padding: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .swagger-ui {
        max-width: 1460px;
        margin: 0 auto;
        background: white;
        box-shadow: 0 0 40px rgba(0, 0, 0, 0.15);
      }

      /* Custom header */
      .swagger-ui .topbar {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-bottom: 3px solid #5a67d8;
        padding: 15px 0;
      }

      .swagger-ui .topbar .wrapper {
        padding: 0 20px;
      }

      .swagger-ui .topbar .topbar-wrapper {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .api-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 60px 40px 40px;
        position: relative;
        overflow: hidden;
      }

      .api-header::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -10%;
        width: 60%;
        height: 200%;
        background: rgba(255, 255, 255, 0.05);
        transform: rotate(35deg);
      }

      .api-header h1 {
        margin: 0 0 15px 0;
        font-size: 42px;
        font-weight: 700;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .api-header p {
        margin: 0 0 20px 0;
        font-size: 18px;
        opacity: 0.95;
        max-width: 600px;
      }

      .api-header .badges {
        display: flex;
        gap: 12px;
        margin-top: 20px;
        position: relative;
        z-index: 1;
      }

      .api-header .badge {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 14px;
        backdrop-filter: blur(10px);
        transition: all 0.3s ease;
      }

      .api-header .badge:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-2px);
      }

      /* Info section styling */
      .swagger-ui .info {
        margin: 40px 0;
        padding: 0 40px;
      }

      .swagger-ui .info .title {
        font-size: 36px;
        font-weight: 700;
        color: #2d3748;
      }

      .swagger-ui .info .description {
        font-size: 16px;
        color: #4a5568;
        line-height: 1.6;
        margin-top: 20px;
      }

      /* Scheme selector */
      .swagger-ui .scheme-container {
        background: #f7fafc;
        padding: 15px 40px;
        border-bottom: 1px solid #e2e8f0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
      }

      /* Operation tags */
      .swagger-ui .opblock-tag {
        color: #2d3748;
        font-size: 24px;
        font-weight: 600;
        margin: 30px 0 20px;
        padding: 0 40px;
        border: none;
      }

      .swagger-ui .opblock-tag:hover {
        background: rgba(102, 126, 234, 0.05);
      }

      /* Operation blocks */
      .swagger-ui .opblock {
        margin: 0 40px 15px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        border: 1px solid #e2e8f0;
        transition: all 0.3s ease;
      }

      .swagger-ui .opblock:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        transform: translateY(-2px);
      }

      .swagger-ui .opblock .opblock-summary {
        border: none;
        padding: 15px 20px;
      }

      /* Method labels with gradient */
      .swagger-ui .opblock.opblock-get .opblock-summary-method {
        background: linear-gradient(135deg, #48bb78, #38a169);
      }

      .swagger-ui .opblock.opblock-post .opblock-summary-method {
        background: linear-gradient(135deg, #4299e1, #3182ce);
      }

      .swagger-ui .opblock.opblock-put .opblock-summary-method {
        background: linear-gradient(135deg, #ed8936, #dd6b20);
      }

      .swagger-ui .opblock.opblock-delete .opblock-summary-method {
        background: linear-gradient(135deg, #f56565, #e53e3e);
      }

      .swagger-ui .opblock .opblock-summary-method {
        min-width: 80px;
        padding: 8px 15px;
        border-radius: 4px;
        font-weight: 700;
        font-size: 14px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      /* Response codes */
      .swagger-ui .responses-inner h4 {
        font-size: 18px;
        font-weight: 600;
        color: #2d3748;
      }

      .swagger-ui .response {
        border-radius: 6px;
        margin-bottom: 12px;
      }

      /* Models section */
      .swagger-ui .models {
        margin: 40px;
        padding: 30px;
        background: #f7fafc;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
      }

      .swagger-ui .model-container {
        background: white;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        border: 1px solid #e2e8f0;
      }

      /* Parameters */
      .swagger-ui .parameter__name {
        color: #5a67d8;
        font-weight: 600;
      }

      .swagger-ui .parameter__type {
        color: #718096;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 13px;
      }

      /* Try it out button */
      .swagger-ui .btn.try-out__btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 6px;
        font-weight: 600;
        transition: all 0.3s ease;
      }

      .swagger-ui .btn.try-out__btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .swagger-ui .btn.execute {
        background: linear-gradient(135deg, #48bb78, #38a169);
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 6px;
        font-weight: 600;
      }

      .swagger-ui .btn.execute:hover {
        background: linear-gradient(135deg, #38a169, #2f855a);
      }

      /* Authorization */
      .swagger-ui .authorization__btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
      }

      .swagger-ui .authorization__btn:hover {
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      /* Select dropdowns */
      .swagger-ui select {
        padding: 8px 12px;
        border: 2px solid #e2e8f0;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.3s ease;
      }

      .swagger-ui select:focus {
        border-color: #667eea;
        outline: none;
      }

      /* Input fields */
      .swagger-ui input[type=text],
      .swagger-ui input[type=password],
      .swagger-ui textarea {
        border: 2px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;
        transition: border-color 0.3s ease;
      }

      .swagger-ui input:focus,
      .swagger-ui textarea:focus {
        border-color: #667eea;
        outline: none;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      /* Copy button */
      .swagger-ui .copy-to-clipboard {
        background: #667eea;
        border-radius: 4px;
        padding: 6px 10px;
      }

      .swagger-ui .copy-to-clipboard:hover {
        background: #5a67d8;
      }

      /* Scrollbar styling */
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      ::-webkit-scrollbar-track {
        background: #f1f1f1;
      }

      ::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 5px;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #5a67d8, #6b46a3);
      }

      /* Loading animation */
      .swagger-ui .loading {
        position: relative;
      }

      .swagger-ui .loading:after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 40px;
        height: 40px;
        margin: -20px 0 0 -20px;
        border: 4px solid #667eea;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Footer */
      .api-footer {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px 40px;
        text-align: center;
        margin-top: 60px;
      }

      .api-footer a {
        color: white;
        text-decoration: none;
        margin: 0 15px;
        transition: opacity 0.3s;
      }

      .api-footer a:hover {
        opacity: 0.8;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .swagger-ui .opblock {
          margin: 0 20px 10px;
        }

        .api-header h1 {
          font-size: 32px;
        }

        .api-header p {
          font-size: 16px;
        }
      }
    </style>
</head>
<body>
    <div class="api-header">
      <h1>🧃 JuiceSwap Ponder API</h1>
      <p>Real-time DEX analytics and campaign tracking for Citrea Testnet</p>
      <div class="badges">
        <span class="badge">v1.0.6</span>
        <span class="badge">Citrea Testnet</span>
        <span class="badge">REST API</span>
        <span class="badge">GraphQL</span>
      </div>
    </div>

    <div id="swagger-ui"></div>

    <div class="api-footer">
      <p>© 2024 JuiceSwap | Built with ❤️ for DeFi</p>
      <div style="margin-top: 15px;">
        <a href="https://juiceswap.com" target="_blank">Website</a>
        <a href="https://github.com/JuiceSwapxyz" target="_blank">GitHub</a>
        <a href="https://docs.juiceswap.com" target="_blank">Documentation</a>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '${specUrl}',
          dom_id: '#swagger-ui',
          deepLinking: true,
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
          ],
          layout: "StandaloneLayout",
          validatorUrl: null,
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 1,
          displayOperationId: false,
          tagsSorter: 'alpha',
          operationsSorter: 'alpha',
          onComplete: function() {
            console.log("Swagger UI loaded successfully");
          }
        });
      };
    </script>
</body>
</html>
`;