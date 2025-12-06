export class Vector2 {
    x: number;
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    magnitude(): number {
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    }

    normalize(): Vector2 {
        const mag = this.magnitude();
        if (mag === 0) {
            return new Vector2(0, 0);
        }
        return new Vector2(this.x / mag, this.y / mag);
    }

    distance(other: Vector2): number {
        let direction = new Vector2();
        direction.x = other.x - this.x;
        direction.y = other.y - this.y;
        return direction.magnitude();
    }
}