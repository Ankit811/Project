import pkg from 'mssql';
const { connect } = pkg;

const sqlConfig = {
  user: process.env.SQL_USER || 'essl',
  password: process.env.SQL_PASSWORD || 'essl',
  server: '192.168.1.7', // remove instance from here
  database: process.env.SQL_DATABASE || 'etimetracklite1old',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: 'SQLEXPRESS', // add this instead of using \SQLEXPRESS
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: 30000,
};

const connectSQL = async () => {
  try {
    console.log('Attempting SQL connection with config:', {
      ...sqlConfig,
      password: '****', // Mask password in logs
    });
    const pool = await connect(sqlConfig);
    
    // Add pool monitoring
    pool.on('error', (err) => {
      console.error('SQL Pool error:', {
        message: err.message,
        code: err.code,
        state: err.state,
        severity: err.severity
      });
    });

    pool.on('connect', () => {
      console.log('SQL Pool stats:', {
        activeRequests: pool.activeRequests,
        pendingRequests: pool.pendingRequests,
        poolSize: pool.poolSize,
        waitingClients: pool.waitingClients
      });
    });

    console.log('SQL Server connected to', sqlConfig.server, 'database', sqlConfig.database);
    return pool;
  } catch (err) {
    console.error('SQL Server connection error:', {
      message: err.message,
      config: { ...sqlConfig, password: '****' },
      errorDetails: err.stack,
    });
    throw err;
  }
};

export  { connectSQL, sqlConfig };