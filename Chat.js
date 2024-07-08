const {Model,DataTypes} = require('sequelize');
const sequelize = require('./database');
class Chat extends Model {}

Chat.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    prompt: {
        type: DataTypes.STRING,
        allowNull: false
    },
    response: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'Chat'
});

module.exports = Chat;


