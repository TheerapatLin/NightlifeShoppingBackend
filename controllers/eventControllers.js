const event = require("../schemas/v1/event.schema");

//Get
// const getAllEvents = async (req , res) => {
//     try {

//         let allEvents = await event.find();
//         let allEventsCount = await event.count();
    
//         await res.status(200).json({
//             data:{count : allEventsCount , events : allEvents}
//         })
//     } catch (error) {
//         res.status(400).json({
//             error: error.message
//           });
//     }
// }