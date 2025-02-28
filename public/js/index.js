const carousel = document.querySelector(".carousel");
const firstCard = carousel.querySelector(".fcard");
const arrowBtns = document.querySelectorAll(".wrapper i");

let isDragging = false, startX, startScrollLeft;
let firstCardWidth = firstCard.clientWidth + 20; // Adding margin

arrowBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        // Multiply by 3 to scroll three cards at once
        carousel.scrollLeft += btn.id === "left" ? -firstCardWidth : firstCardWidth;
    });
});

const dragStart = (e) => {
    isDragging = true;
    carousel.classList.add("dragging");
    startX = e.pageX;
    startScrollLeft = carousel.scrollLeft;
}

const dragging = (e) => {
    if(!isDragging) return;
    e.preventDefault();
    carousel.scrollLeft = startScrollLeft - (e.pageX - startX);
}

const dragStop = () => {
    isDragging = false;
    carousel.classList.remove("dragging");
}

carousel.addEventListener("mousedown", dragStart);
carousel.addEventListener("mousemove", dragging);
document.addEventListener("mouseup", dragStop);
carousel.addEventListener("mouseleave", dragStop);

// Autoplay functionality (optional)
// let autoPlay = setInterval(() => {
//     carousel.scrollLeft += firstCardWidth;
// }, 2500);

// Add new code for feedback cards
const fbCarousel = document.querySelector(".fb-carousel");
const fbCards = document.querySelectorAll(".fbcard");
const fbArrowBtns = document.querySelectorAll(".fb-wrapper i");

let fbIsDragging = false, fbStartX, fbStartScrollLeft;
let fbCardWidth = fbCards[0].offsetWidth + 20; // Adding margin

fbArrowBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const scrollAmount = btn.id === "left" ? -fbCardWidth : fbCardWidth;
        fbCarousel.scrollLeft += scrollAmount;
    });
});

const fbDragStart = (e) => {
    fbIsDragging = true;
    fbCarousel.classList.add("dragging");
    fbStartX = e.pageX;
    fbStartScrollLeft = fbCarousel.scrollLeft;
}

const fbDragging = (e) => {
    if(!fbIsDragging) return;
    e.preventDefault();
    fbCarousel.scrollLeft = fbStartScrollLeft - (e.pageX - fbStartX);
}

const fbDragStop = () => {
    fbIsDragging = false;
    fbCarousel.classList.remove("dragging");
}

fbCarousel.addEventListener("mousedown", fbDragStart);
fbCarousel.addEventListener("mousemove", fbDragging);
document.addEventListener("mouseup", fbDragStop);
fbCarousel.addEventListener("mouseleave", fbDragStop);
