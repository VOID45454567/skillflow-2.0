import { Module } from "@nestjs/common";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
    controllers: [ReviewController],
    exports: [ReviewService],
    providers: [ReviewService]
})
export class ReviewModule { }