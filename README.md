# Art Depart

> Steal the spotlight, masterpiece by masterpiece.

**Art Depart** is an isometric 3D stealth game built with Three.js. You play an art thief slipping through the gilded halls of Renaissance-style museums: dodge a patrolling curator, study the painting on display, then prove you understand its technique to unlock the door and escape with the masterpiece.

It is an educational game at heart. Every level teaches a real painting technique using famous works of art, woven into the gameplay rather than bolted on in front of it.

---

## Table of contents

- [Features](#features)
- [How to play](#how-to-play)
- [Levels](#levels)
- [Educational design](#educational-design)
- [Assets](#assets)
- [Design notes](#design-notes)
- [Known issues](#known-issues)
- [Roadmap](#roadmap)
- [Credits](#credits)

---

## Features

- **Isometric 3D stealth.** Sneak around a patrolling curator whose movements make every route through the room a small puzzle.
- **Learn real techniques.** Each gallery teaches one painting technique (impasto, sfumato, pointillism) through a famous example.
- **Test at the door.** Pick which of three paintings best shows the technique. Answer cards flip around to reveal whether you were right.
- **Randomized placement.** The painting and the door are separate interactable objects, so their spawn positions can change between runs.
- **Level select and credits menu** built with a Three.js GUI panel.
- **Hand-painted end credits** scene.

## How to play

| Action                          | Keys                          |
| ------------------------------- | ----------------------------- |
| Move                            | `W` `A` `S` `D` or arrow keys |
| Study a painting / try the door | `E`                           |
| Close a pop-up                  | `Esc` or the ✕ button         |
| Change level / show credits     | GUI panel, top right          |

Movement snaps to the four directions, like a classic 2D RPG.

**Every level follows the same loop:**

1. Make your way down the room without running into the curator.
2. Reach the easel and read about the painting's technique.
3. Get to the door and pass the test by choosing the painting that best shows that technique.

Bumping into the curator sends her off somewhere else in the room, so timing your route matters more than speed. Doubling back to look at the painting again is allowed and intended.

## Levels

| Level | Setting                                | Technique       | Featured work                                 |
| ----- | -------------------------------------- | --------------- | --------------------------------------------- |
| 1     | Warm wooden hall with stained glass    | **Impasto**     | Vincent van Gogh, _The Starry Night_          |
| 2     | Dark stone gallery with arched windows | **Sfumato**     | Leonardo da Vinci, _Mona Lisa_                |
| 3     | Night wing lit by lattice windows      | **Pointillism** | Georges Seurat, _A Sunday on La Grande Jatte_ |

### The techniques

**Impasto.** Paint is laid on so thickly that brush or palette-knife strokes stay visible and read as lines. Paint can be mixed right on the canvas, and in person it appears to rise out of the surface.

**Sfumato.** A hazy quality that blurs contours, so figures emerge from a dark background through gradual changes in tone rather than harsh outlines. The figures almost fuse with their surroundings.

**Pointillism.** Dots of color are applied separately to the surface so that, from a distance, they visually blend together.

## Educational design

The game is built so the learning never gets in the way of the play.

- **Game first, reading second.** Players get the stealth gameplay up front to hook their interest, then read to earn more game. Leading with a wall of text would sour the experience before it starts.
- **Safe to learn.** Once you are past the curator, pop-ups pause the threat. You can read the material and take the test at your own pace.
- **Separated loops.** Keeping the stealth and the test apart works like a reward system. Each half makes the other feel like a payoff.
- **Fun even in the test.** Answer cards flip with a playful wobble to reveal _Correct_ or _Incorrect_, which keeps testing light.

## Assets

All 3D assets were modeled in Blender by Kite Randel.

- **Player and curator.** Both characters share the same base model and rig. That saved modeling and rigging time and lets them share animations.
- **Environments.** One model per level. The door and easel are kept as separate objects because they need to be interactable, which also allows randomized spawns and more freedom in placement.
- **Doors.** A stained-glass door for Level 1 and a wooden door for Levels 2 and 3.
- **Paintings.** Each painting is a Blender plane with the artwork applied as an image texture, set on an easel stand.
- **End credits.** A large painted scene of the thief looking out over a purple landscape.

## Design notes

**Controls went through a rewrite.** The first version used tank controls: `A` and `D` rotated the player while `W` and `S` moved them forward and back, like driving a car. It felt awful, so movement was changed to snap to the facing direction, like an old 2D four-way RPG.

**Props had to stay out of the way.** The rooms would look richer with more furniture, but collisions in the middle of the floor would block both the player and the curator. Props sit along the edges instead.

**Invisible walls keep everyone in bounds.** Each room is wrapped in collision walls so the player can never walk out of the level.

**GUI over hand-built menus.** Building level transitions from scratch in vanilla JavaScript proved difficult, so the Three.js GUI panel handles level selection and the credits toggle.

## Known issues

- **Level 2 floor texture.** The wooden floor texture would not render as brown, so the floor uses a darker stone look.
- **Level 3 lighting.** The level is darker than intended. Tuning lighting in code is harder than placing lights in a game engine editor.
- **Limited props.** Rooms are sparser than planned, partly because of the collision constraint above.

## Credits

Created by Kite Randel & Erik Lopez.

Featured artworks are by Vincent van Gogh, Leonardo da Vinci, Georges Seurat, Johannes Vermeer, Édouard Manet, Georges Braque, Claude Monet and Paul Gauguin. They are used for educational purposes.
