import { v2 as cloudinary } from "cloudinary";

// Cloudinary free tier: 25 credits/month (~25GB storage+bandwidth combined),
// more than enough for a few hundred worker profile/CNIC/selfie images.
// Sign up free at https://cloudinary.com/users/register/free
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;
