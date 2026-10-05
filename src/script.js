import "./style.css";
import Orchestrator from "./ThreeJS/Orchestrator.js";
import gsap from "gsap";

const orchestrator = new Orchestrator(document.querySelector("canvas.webgl"));


// Staggered fade-in animation for text elements
const animatedElements = [
    ".nav-logo a",
    ".bar-memory a",
];

gsap.fromTo(
    animatedElements,
    {
        opacity: 0,
        y: 20,
    },
    {
        duration: 1,
        opacity: 1,
        y: 0,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.5,
    },
);
