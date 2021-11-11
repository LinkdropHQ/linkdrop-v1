import configs from '../../../../configs'
const mongoose = require('mongoose')

// Set up default mongoose connection
const connectDB = () => {
  const config = configs.get('auth')
  return mongoose.connect(
    config.mongoURI || 'mongodb://localhost:27017/linkdrop_default_db',
    {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true
    }
  )
}

export default connectDB
