<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Enums\Role;
use function Pest\Laravel\getJson;

beforeEach(function(){
    // create admin user
    $this->admin = User::factory()->create(['role'=>Role::ADMIN,'password'=>bcrypt('password')]);

    // seed products
    $p1 = Product::factory()->create(['price'=>100]);
    $p2 = Product::factory()->create(['price'=>200]);

    // create orders (2 orders)
    $o1 = Order::factory()->create(['total_gross'=>300,'total_net'=>258.62,'vat_amount'=>41.38,'status'=>'COMPLETED']);
    $o2 = Order::factory()->create(['total_gross'=>500,'total_net'=>431.03,'vat_amount'=>68.97,'status'=>'PENDING']);

    OrderItem::factory()->create(['order_id'=>$o1->id,'product_id'=>$p1->id,'quantity'=>1,'unit_price_gross'=>100,'unit_price_net'=>86.21,'vat_amount'=>13.79]);
    OrderItem::factory()->create(['order_id'=>$o1->id,'product_id'=>$p2->id,'quantity'=>1,'unit_price_gross'=>200,'unit_price_net'=>172.41,'vat_amount'=>27.59]);
    OrderItem::factory()->create(['order_id'=>$o2->id,'product_id'=>$p2->id,'quantity'=>2,'unit_price_gross'=>200,'unit_price_net'=>172.41,'vat_amount'=>27.59]);
});

it('returns dashboard stats including AOV', function(){
    $token = $this->admin->createToken('t')->plainTextToken;
    $resp = getJson('/api/admin/dashboard/stats', ['Authorization'=>'Bearer '.$token]);
    $resp->assertStatus(200)
        ->assertJsonStructure(['totalOrders','totalRevenue','averageOrderValue'])
        ->assertJson(fn($json)=> $json
            ->where('totalOrders', 2)
            ->where('totalRevenue', 800.00)
            ->where('averageOrderValue', 400.00)
            ->etc()
        );
});

it('returns analytics overview with AOV and trends', function(){
    $token = $this->admin->createToken('t')->plainTextToken;
    $resp = getJson('/api/admin/analytics/overview?revenueDays=7', ['Authorization'=>'Bearer '.$token]);
    $resp->assertStatus(200)
        ->assertJsonStructure([
            'revenueTrendDaily','revenueTrendWeekly','revenueTrendMonthly','overallAov','weeklyChangePct','monthlyChangePct','repeatCustomers','repeatRate'
        ])
        ->assertJson(fn($json)=> $json
            ->where('overallAov', 400.00)
            ->where('windowDays', 7)
            ->etc()
        );
});

it('returns unified analytics buckets respecting status filters', function(){
    $token = $this->admin->createToken('t')->plainTextToken;

    // Additional cancelled order in window
    Order::factory()->create([
        'total_gross' => 150,
        'total_net' => 129.31,
        'vat_amount' => 20.69,
        'status' => 'CANCELLED',
        'created_at' => now()->subDay(),
    ]);

    $baseHeaders = ['Authorization' => 'Bearer ' . $token];

    $resp = getJson('/api/admin/analytics/unified?granularity=DAILY&statuses=PENDING&statuses=DELIVERED', $baseHeaders);
    $resp->assertStatus(200)
        ->assertJsonStructure([
            'aggregates' => ['totalOrders','totalGross','overallAov','paymentSuccessRate'],
            'buckets',
            'totals' => ['grossRevenue','orders','avgOrderValue','paymentSuccessRate','from','to'],
            'trend'
        ]);

    $data = $resp->json();
    expect($data['aggregates']['totalOrders'])->toBe(2);
    expect($data['aggregates']['totalGross'])->toBe(800.0);
    expect($data['aggregates']['overallAov'])->toBe(400.0);
    expect($data['buckets'])->toBeArray();
    expect($data['buckets'])->not->toBeEmpty();

    // Without delivered status, only pending order should remain unless cancelled included explicitly
    $respFiltered = getJson('/api/admin/analytics/unified?granularity=DAILY&statuses=PENDING', $baseHeaders);
    $filtered = $respFiltered->json();
    expect($filtered['aggregates']['totalOrders'])->toBe(1);
    expect($filtered['aggregates']['totalGross'])->toBe(500.0);

    // Including cancelled should pull in cancelled order alongside pending
    $respWithCancelled = getJson('/api/admin/analytics/unified?granularity=DAILY&statuses=PENDING&includeCancelled=true', $baseHeaders);
    $withCancelled = $respWithCancelled->json();
    expect($withCancelled['aggregates']['totalOrders'])->toBe(2);
    expect($withCancelled['aggregates']['totalGross'])->toBe(650.0);
});
