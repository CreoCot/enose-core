import axios from "axios";

const instance = axios.create({
  baseURL: "https://backend.com/",
});
export default instance;
