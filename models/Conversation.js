import mongoose from "mongoose";
const {Schema,model} = mongoose;

const ConversationSchema = new Schema({
    senderemail:{type:String},
    receiveremail:{type:String},
    messages:{type:Array}
})

export default mongoose.models.Conversation || model("Conversation",ConversationSchema);