import mongoose from "mongoose";
const {Schema,model} = mongoose;

const UserSchema = new Schema({
    username:{type:String},
    email:{type:String,required:true},
    profilepic:{type:String},
    uid:{type:String},
    friends:{type:Array}
})

export default mongoose.models.User || model("User",UserSchema);